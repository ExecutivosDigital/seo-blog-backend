import { OnWorkerEvent, Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { ContentStatus, PublishJobStatus } from '@prisma/client';
import axios from 'axios';
import { Job } from 'bullmq';
import { PrismaService } from '@/shared/database/prisma/prisma.service';
import { PUBLISH_QUEUE } from '../schedule/schedule.service';

interface PublishJobData {
  jobId: string;
  contentId: string;
}

@Processor(PUBLISH_QUEUE)
export class PublishProcessor extends WorkerHost {
  private readonly logger = new Logger(PublishProcessor.name);

  constructor(private prisma: PrismaService) {
    super();
  }

  async process(job: Job<PublishJobData>) {
    const { jobId, contentId } = job.data;
    this.logger.log(`Processing publish job ${jobId} → content ${contentId}`);

    await this.prisma.publishJob.update({
      where: { id: jobId },
      data: {
        status: PublishJobStatus.RUNNING,
        startedAt: new Date(),
        attempts: { increment: 1 },
      },
    });

    const content = await this.prisma.content.findUnique({
      where: { id: contentId },
      include: {
        contentType: { select: { routePrefix: true } },
      },
    });
    if (!content) throw new Error(`Content ${contentId} not found`);

    if (content.status === ContentStatus.PUBLISHED) {
      this.logger.warn(`Content ${contentId} already PUBLISHED — marking job SUCCEEDED`);
      await this.markSucceeded(jobId);
      return { skipped: true };
    }

    const updated = await this.prisma.content.update({
      where: { id: contentId },
      data: {
        status: ContentStatus.PUBLISHED,
        publishedAt: new Date(),
        version: { increment: 1 },
      },
    });

    await this.prisma.contentVersion
      .create({
        data: {
          contentId,
          version: updated.version,
          snapshot: { transitionTo: 'PUBLISHED', publishedAt: updated.publishedAt } as object,
        },
      })
      .catch(() => undefined);

    // Webhook revalidate (best-effort)
    const site = await this.prisma.site.findUnique({ where: { id: content.siteId } });
    const path = `${content.contentType.routePrefix}/${content.slug}`;
    if (site?.revalidateUrl) {
      try {
        await axios.post(
          site.revalidateUrl,
          { path, slug: content.slug, locale: content.locale, action: 'publish' },
          {
            headers: site.revalidateSecret
              ? { 'X-Revalidate-Secret': site.revalidateSecret }
              : {},
            timeout: 15_000,
          },
        );
        this.logger.log(`Revalidated ${site.revalidateUrl} for ${path}`);
      } catch (err: any) {
        this.logger.warn(
          `Revalidate failed for site ${site.slug}: ${err?.message ?? String(err)}`,
        );
      }
    }

    // IndexNow ping (best-effort) — só faz se site tem indexnowKey + domain
    if (site?.indexnowKey && site.domain) {
      const fullUrl = `https://${site.domain}${path}`;
      try {
        await axios.post(
          'https://api.indexnow.org/IndexNow',
          {
            host: site.domain,
            key: site.indexnowKey,
            urlList: [fullUrl],
          },
          { timeout: 10_000 },
        );
        this.logger.log(`IndexNow pinged for ${fullUrl}`);
      } catch (err: any) {
        this.logger.warn(`IndexNow ping failed: ${err?.message ?? String(err)}`);
      }
    }

    await this.markSucceeded(jobId);
    return { ok: true };
  }

  @OnWorkerEvent('failed')
  async onFailed(job: Job<PublishJobData>, err: Error) {
    const isFinalAttempt = (job.attemptsMade ?? 0) >= (job.opts.attempts ?? 1);
    this.logger.error(
      `Publish job ${job.data.jobId} failed (attempt ${job.attemptsMade}/${job.opts.attempts}): ${err.message}`,
    );
    if (isFinalAttempt) {
      await this.prisma.publishJob
        .update({
          where: { id: job.data.jobId },
          data: {
            status: PublishJobStatus.FAILED,
            lastError: err.message,
            finishedAt: new Date(),
          },
        })
        .catch(() => undefined);
    }
  }

  private async markSucceeded(jobId: string) {
    await this.prisma.publishJob.update({
      where: { id: jobId },
      data: { status: PublishJobStatus.SUCCEEDED, finishedAt: new Date(), lastError: null },
    });
  }
}
