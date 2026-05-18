import { InjectQueue } from '@nestjs/bullmq';
import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ContentStatus, PublishJobStatus } from '@prisma/client';
import { Queue } from 'bullmq';
import { PrismaService } from '@/shared/database/prisma/prisma.service';
import { RescheduleDto, ScheduleBulkDto, ScheduleOneDto, SchedulingMode } from './dto/schedule.dto';

export const PUBLISH_QUEUE = 'publish';

@Injectable()
export class ScheduleService {
  private readonly logger = new Logger(ScheduleService.name);

  constructor(
    private prisma: PrismaService,
    @InjectQueue(PUBLISH_QUEUE) private queue: Queue,
  ) {}

  async list(params: { siteId?: string; from?: string; to?: string }) {
    const fromDate = params.from ? new Date(params.from) : undefined;
    const toDate = params.to ? new Date(params.to) : undefined;
    return this.prisma.publishJob.findMany({
      where: {
        ...(fromDate || toDate
          ? {
              scheduledFor: {
                ...(fromDate ? { gte: fromDate } : {}),
                ...(toDate ? { lte: toDate } : {}),
              },
            }
          : {}),
        ...(params.siteId ? { content: { siteId: params.siteId } } : {}),
      },
      orderBy: { scheduledFor: 'asc' },
      include: {
        content: {
          select: {
            id: true,
            title: true,
            slug: true,
            status: true,
            ogImage: { select: { url: true } },
            contentType: { select: { slug: true, name: true } },
          },
        },
      },
      take: 1000,
    });
  }

  async scheduleOne(dto: ScheduleOneDto, userId?: string) {
    const content = await this.prisma.content.findUnique({ where: { id: dto.contentId } });
    if (!content) throw new NotFoundException('Content not found');
    if (content.status !== ContentStatus.APPROVED && content.status !== ContentStatus.SCHEDULED) {
      throw new BadRequestException(
        `Conteúdo precisa estar APPROVED para agendar (atual: ${content.status})`,
      );
    }
    const scheduledFor = new Date(dto.scheduledFor);
    return this.createJob(content.id, scheduledFor, userId);
  }

  async reschedule(jobId: string, dto: RescheduleDto) {
    const job = await this.prisma.publishJob.findUnique({ where: { id: jobId } });
    if (!job) throw new NotFoundException('Job not found');
    if (job.status === PublishJobStatus.SUCCEEDED) {
      throw new BadRequestException('Cannot reschedule a SUCCEEDED job');
    }
    const newDate = new Date(dto.scheduledFor);
    if (job.bullJobId) {
      const bullJob = await this.queue.getJob(job.bullJobId);
      if (bullJob) await bullJob.remove().catch(() => undefined);
    }
    const next = await this.prisma.publishJob.update({
      where: { id: jobId },
      data: { scheduledFor: newDate, status: PublishJobStatus.PENDING, attempts: 0, lastError: null },
    });
    await this.prisma.content.update({
      where: { id: job.contentId },
      data: { scheduledFor: newDate, status: ContentStatus.SCHEDULED },
    });
    const bullJob = await this.queue.add(
      'publish',
      { jobId: next.id, contentId: next.contentId },
      {
        delay: Math.max(0, newDate.getTime() - Date.now()),
        attempts: 3,
        backoff: { type: 'exponential', delay: 30_000 },
        removeOnComplete: 100,
        removeOnFail: 200,
      },
    );
    return this.prisma.publishJob.update({
      where: { id: jobId },
      data: { bullJobId: bullJob.id ?? null },
    });
  }

  async cancel(jobId: string) {
    const job = await this.prisma.publishJob.findUnique({ where: { id: jobId } });
    if (!job) throw new NotFoundException('Job not found');
    if (job.bullJobId) {
      const bj = await this.queue.getJob(job.bullJobId);
      if (bj) await bj.remove().catch(() => undefined);
    }
    await this.prisma.publishJob.update({
      where: { id: jobId },
      data: { status: PublishJobStatus.CANCELLED },
    });
    // volta o conteúdo para APPROVED se ainda não publicou
    const content = await this.prisma.content.findUnique({ where: { id: job.contentId } });
    if (content && content.status === ContentStatus.SCHEDULED) {
      await this.prisma.content.update({
        where: { id: job.contentId },
        data: { status: ContentStatus.APPROVED, scheduledFor: null },
      });
    }
    return { ok: true };
  }

  async scheduleBulk(dto: ScheduleBulkDto, userId?: string) {
    const contents = await this.prisma.content.findMany({
      where: { id: { in: dto.contentIds } },
    });
    if (contents.length === 0) throw new BadRequestException('No contents found');
    const invalid = contents.filter(
      (c) => c.status !== ContentStatus.APPROVED && c.status !== ContentStatus.SCHEDULED,
    );
    if (invalid.length > 0) {
      throw new BadRequestException(
        `${invalid.length} conteúdos não estão APPROVED: ${invalid.map((c) => c.title).slice(0, 3).join(', ')}…`,
      );
    }

    const dates = this.computeDates({
      n: contents.length,
      startDate: dto.startDate,
      time: dto.time ?? '09:00',
      mode: dto.mode,
      everyN: dto.everyN ?? 1,
      skipWeekends: dto.skipWeekends ?? true,
    });

    const jobs: { contentId: string; scheduledFor: Date }[] = [];
    contents.forEach((c, i) => jobs.push({ contentId: c.id, scheduledFor: dates[i] }));

    const created: Array<{ jobId: string; contentId: string; scheduledFor: Date }> = [];
    for (const it of jobs) {
      const j = await this.createJob(it.contentId, it.scheduledFor, userId);
      created.push({ jobId: j.id, contentId: it.contentId, scheduledFor: it.scheduledFor });
    }
    return { count: created.length, jobs: created };
  }

  private computeDates(opts: {
    n: number;
    startDate: string;
    time: string;
    mode: SchedulingMode;
    everyN: number;
    skipWeekends: boolean;
  }): Date[] {
    const [hh, mm] = opts.time.split(':').map(Number);
    const out: Date[] = [];
    // IMPORTANT: parse startDate como LOCAL, não UTC.
    // `new Date("2026-05-19")` é UTC midnight → em fusos negativos vira o dia
    // anterior à noite. Construir com componentes explícitos evita isso.
    const dateOnly = opts.startDate.slice(0, 10);
    const [y, mo, d] = dateOnly.split('-').map(Number);
    let cur = new Date(y, mo - 1, d, hh, mm, 0, 0);

    while (out.length < opts.n) {
      if (opts.skipWeekends) {
        while (cur.getDay() === 0 || cur.getDay() === 6) {
          cur = new Date(cur.getTime() + 24 * 3600 * 1000);
        }
      }
      out.push(new Date(cur));
      // próximo
      const stepDays =
        opts.mode === SchedulingMode.DAILY
          ? 1
          : opts.mode === SchedulingMode.WEEKLY
            ? 7
            : Math.max(1, opts.everyN);
      cur = new Date(cur.getTime() + stepDays * 24 * 3600 * 1000);
    }
    return out;
  }

  private async createJob(contentId: string, scheduledFor: Date, userId?: string) {
    const delay = Math.max(0, scheduledFor.getTime() - Date.now());
    const job = await this.prisma.publishJob.create({
      data: {
        contentId,
        scheduledFor,
        status: PublishJobStatus.PENDING,
        createdBy: userId ?? null,
      },
    });
    // atualizar Content
    await this.prisma.content.update({
      where: { id: contentId },
      data: { scheduledFor, status: ContentStatus.SCHEDULED },
    });
    try {
      const bullJob = await this.queue.add(
        'publish',
        { jobId: job.id, contentId },
        {
          delay,
          attempts: 3,
          backoff: { type: 'exponential', delay: 30_000 },
          removeOnComplete: 100,
          removeOnFail: 200,
        },
      );
      await this.prisma.publishJob.update({
        where: { id: job.id },
        data: { bullJobId: bullJob.id ?? null },
      });
    } catch (e) {
      this.logger.warn(`failed to enqueue publish job ${job.id}: ${e}`);
    }
    return job;
  }
}
