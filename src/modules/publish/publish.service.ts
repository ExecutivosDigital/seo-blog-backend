import { InjectQueue } from '@nestjs/bullmq';
import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { ContentStatus, PublishJobStatus } from '@prisma/client';
import { Queue } from 'bullmq';
import { PrismaService } from '@/shared/database/prisma/prisma.service';
import { PUBLISH_QUEUE } from '../schedule/schedule.service';

@Injectable()
export class PublishService {
  constructor(
    private prisma: PrismaService,
    @InjectQueue(PUBLISH_QUEUE) private queue: Queue,
  ) {}

  async publishNow(contentId: string, userId?: string) {
    const content = await this.prisma.content.findUnique({ where: { id: contentId } });
    if (!content) throw new NotFoundException('Content not found');
    if (
      content.status !== ContentStatus.APPROVED &&
      content.status !== ContentStatus.SCHEDULED &&
      content.status !== ContentStatus.UNPUBLISHED
    ) {
      throw new BadRequestException(
        `Content must be APPROVED/SCHEDULED/UNPUBLISHED (atual: ${content.status})`,
      );
    }
    const job = await this.prisma.publishJob.create({
      data: {
        contentId,
        scheduledFor: new Date(),
        status: PublishJobStatus.PENDING,
        createdBy: userId ?? null,
      },
    });
    const bullJob = await this.queue.add(
      'publish',
      { jobId: job.id, contentId },
      {
        attempts: 3,
        backoff: { type: 'exponential', delay: 5_000 },
        removeOnComplete: 100,
        removeOnFail: 200,
      },
    );
    await this.prisma.publishJob.update({
      where: { id: job.id },
      data: { bullJobId: bullJob.id ?? null },
    });
    return job;
  }

  async retry(jobId: string) {
    const job = await this.prisma.publishJob.findUnique({ where: { id: jobId } });
    if (!job) throw new NotFoundException('Job not found');
    if (job.status !== PublishJobStatus.FAILED) {
      throw new BadRequestException(`Only FAILED jobs can be retried (atual: ${job.status})`);
    }
    await this.prisma.publishJob.update({
      where: { id: jobId },
      data: { status: PublishJobStatus.PENDING, lastError: null },
    });
    const bullJob = await this.queue.add(
      'publish',
      { jobId: job.id, contentId: job.contentId },
      {
        attempts: 3,
        backoff: { type: 'exponential', delay: 5_000 },
        removeOnComplete: 100,
        removeOnFail: 200,
      },
    );
    await this.prisma.publishJob.update({
      where: { id: job.id },
      data: { bullJobId: bullJob.id ?? null },
    });
    return job;
  }

  async listAll(params: { siteId?: string; status?: PublishJobStatus; page?: number; pageSize?: number }) {
    const page = params.page ?? 1;
    const pageSize = params.pageSize ?? 50;
    const where = {
      ...(params.status ? { status: params.status } : {}),
      ...(params.siteId ? { content: { siteId: params.siteId } } : {}),
    };
    const [items, total] = await this.prisma.$transaction([
      this.prisma.publishJob.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
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
      }),
      this.prisma.publishJob.count({ where }),
    ]);
    return { items, total, page, pageSize };
  }
}
