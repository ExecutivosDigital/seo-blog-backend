import { Injectable } from '@nestjs/common';
import {
  ContentStatus,
  IdeaStatus,
  Prisma,
  PublishJobStatus,
} from '@prisma/client';
import { PrismaService } from '@/shared/database/prisma/prisma.service';

@Injectable()
export class MetricsService {
  constructor(private prisma: PrismaService) {}

  async overview(siteId?: string) {
    const now = new Date();
    const startOfDay = new Date(now);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(startOfDay);
    endOfDay.setDate(endOfDay.getDate() + 1);
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 3600 * 1000);
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 3600 * 1000);
    const sevenAhead = new Date(now.getTime() + 7 * 24 * 3600 * 1000);

    const siteFilter = siteId ? { siteId } : {};
    const contentSiteFilter = siteId ? { content: { siteId } } : {};

    const [
      ideasPending,
      ideasTotal,
      contentsDraft,
      contentsExpanded,
      contentsApproved,
      contentsPublished,
      contentsTotal,
      scheduledToday,
      scheduledWeek,
      publishedWeek,
      publishedMonth,
      jobsLast30,
      jobsSucceeded30,
      jobsFailed30,
      aiCost7,
      aiCost30,
      aiCostToday,
    ] = await Promise.all([
      this.prisma.idea.count({ where: { ...siteFilter, status: IdeaStatus.PENDING } }),
      this.prisma.idea.count({ where: siteFilter }),
      this.prisma.content.count({ where: { ...siteFilter, status: ContentStatus.DRAFT } }),
      this.prisma.content.count({ where: { ...siteFilter, status: ContentStatus.EXPANDED } }),
      this.prisma.content.count({ where: { ...siteFilter, status: ContentStatus.APPROVED } }),
      this.prisma.content.count({ where: { ...siteFilter, status: ContentStatus.PUBLISHED } }),
      this.prisma.content.count({ where: siteFilter }),
      this.prisma.publishJob.count({
        where: {
          ...contentSiteFilter,
          scheduledFor: { gte: startOfDay, lt: endOfDay },
          status: PublishJobStatus.PENDING,
        },
      }),
      this.prisma.publishJob.count({
        where: {
          ...contentSiteFilter,
          scheduledFor: { gte: now, lt: sevenAhead },
          status: PublishJobStatus.PENDING,
        },
      }),
      this.prisma.content.count({
        where: { ...siteFilter, publishedAt: { gte: sevenDaysAgo } },
      }),
      this.prisma.content.count({
        where: { ...siteFilter, publishedAt: { gte: thirtyDaysAgo } },
      }),
      this.prisma.publishJob.count({
        where: { ...contentSiteFilter, createdAt: { gte: thirtyDaysAgo } },
      }),
      this.prisma.publishJob.count({
        where: {
          ...contentSiteFilter,
          createdAt: { gte: thirtyDaysAgo },
          status: PublishJobStatus.SUCCEEDED,
        },
      }),
      this.prisma.publishJob.count({
        where: {
          ...contentSiteFilter,
          createdAt: { gte: thirtyDaysAgo },
          status: PublishJobStatus.FAILED,
        },
      }),
      this.prisma.aiUsageLog.aggregate({
        where: { ...siteFilter, createdAt: { gte: sevenDaysAgo } },
        _sum: { costCents: true },
        _count: true,
      }),
      this.prisma.aiUsageLog.aggregate({
        where: { ...siteFilter, createdAt: { gte: thirtyDaysAgo } },
        _sum: { costCents: true },
        _count: true,
      }),
      this.prisma.aiUsageLog.aggregate({
        where: { ...siteFilter, createdAt: { gte: startOfDay } },
        _sum: { costCents: true },
        _count: true,
      }),
    ]);

    return {
      ideas: { pending: ideasPending, total: ideasTotal },
      contents: {
        draft: contentsDraft,
        expanded: contentsExpanded,
        approved: contentsApproved,
        published: contentsPublished,
        total: contentsTotal,
      },
      schedule: { today: scheduledToday, nextWeek: scheduledWeek },
      publish: {
        publishedLast7Days: publishedWeek,
        publishedLast30Days: publishedMonth,
        jobsLast30: jobsLast30,
        succeededLast30: jobsSucceeded30,
        failedLast30: jobsFailed30,
        successRate:
          jobsLast30 > 0 ? Math.round((jobsSucceeded30 / jobsLast30) * 100) : null,
      },
      aiCost: {
        today: {
          calls: aiCostToday._count,
          costCents: aiCostToday._sum.costCents ?? 0,
        },
        last7Days: {
          calls: aiCost7._count,
          costCents: aiCost7._sum.costCents ?? 0,
        },
        last30Days: {
          calls: aiCost30._count,
          costCents: aiCost30._sum.costCents ?? 0,
        },
      },
    };
  }

  async publishStats(params: { siteId?: string; days?: number }) {
    const days = params.days ?? 30;
    const since = new Date();
    since.setDate(since.getDate() - days);

    const where: Prisma.PublishJobWhereInput = {
      createdAt: { gte: since },
      ...(params.siteId ? { content: { siteId: params.siteId } } : {}),
    };

    const [total, succeeded, failed, cancelled, pending, durationStats, byDay] =
      await Promise.all([
        this.prisma.publishJob.count({ where }),
        this.prisma.publishJob.count({ where: { ...where, status: PublishJobStatus.SUCCEEDED } }),
        this.prisma.publishJob.count({ where: { ...where, status: PublishJobStatus.FAILED } }),
        this.prisma.publishJob.count({ where: { ...where, status: PublishJobStatus.CANCELLED } }),
        this.prisma.publishJob.count({ where: { ...where, status: PublishJobStatus.PENDING } }),
        // Duração = finished_at - started_at. SQL raw para compute em ms.
        this.prisma.$queryRaw<Array<{ avg_ms: number | null; max_ms: number | null }>>`
          SELECT
            AVG(EXTRACT(EPOCH FROM (finished_at - started_at)) * 1000)::int AS avg_ms,
            MAX(EXTRACT(EPOCH FROM (finished_at - started_at)) * 1000)::int AS max_ms
            FROM publish_jobs
           WHERE created_at >= ${since}
             AND status = 'SUCCEEDED'
             AND started_at IS NOT NULL
             AND finished_at IS NOT NULL
             ${params.siteId ? Prisma.sql`AND content_id IN (SELECT id FROM contents WHERE site_id = ${params.siteId}::uuid)` : Prisma.sql``}
        `,
        this.prisma.$queryRaw<Array<{ day: Date; total: bigint; succeeded: bigint; failed: bigint }>>`
          SELECT date_trunc('day', created_at) AS day,
                 COUNT(*)::bigint AS total,
                 COUNT(*) FILTER (WHERE status = 'SUCCEEDED')::bigint AS succeeded,
                 COUNT(*) FILTER (WHERE status = 'FAILED')::bigint AS failed
            FROM publish_jobs
           WHERE created_at >= ${since}
             ${params.siteId ? Prisma.sql`AND content_id IN (SELECT id FROM contents WHERE site_id = ${params.siteId}::uuid)` : Prisma.sql``}
           GROUP BY 1
           ORDER BY 1 ASC
        `,
      ]);

    return {
      since,
      days,
      total,
      succeeded,
      failed,
      cancelled,
      pending,
      successRate: total > 0 ? Math.round((succeeded / total) * 100) : null,
      avgDurationMs: durationStats[0]?.avg_ms ?? 0,
      maxDurationMs: durationStats[0]?.max_ms ?? 0,
      byDay: byDay.map((d) => ({
        day: d.day,
        total: Number(d.total),
        succeeded: Number(d.succeeded),
        failed: Number(d.failed),
      })),
    };
  }

  async aiCostCsv(params: { siteId?: string; days?: number }) {
    const days = params.days ?? 30;
    const since = new Date();
    since.setDate(since.getDate() - days);
    const rows = await this.prisma.aiUsageLog.findMany({
      where: {
        createdAt: { gte: since },
        ...(params.siteId ? { siteId: params.siteId } : {}),
      },
      orderBy: { createdAt: 'desc' },
      take: 50_000,
    });
    const header = [
      'created_at',
      'site_id',
      'content_id',
      'kind',
      'model',
      'input_tokens',
      'output_tokens',
      'cost_cents',
      'cached',
      'duration_ms',
    ].join(',');
    const lines = rows.map((r) =>
      [
        r.createdAt.toISOString(),
        r.siteId ?? '',
        r.contentId ?? '',
        r.kind,
        r.model,
        r.inputTokens,
        r.outputTokens,
        r.costCents,
        r.cached ? '1' : '0',
        r.durationMs,
      ]
        .map((v) => String(v).replace(/,/g, ';'))
        .join(','),
    );
    return [header, ...lines].join('\n');
  }

  async aiCost(params: { siteId?: string; days?: number }) {
    const days = params.days ?? 30;
    const since = new Date();
    since.setDate(since.getDate() - days);

    const where = {
      createdAt: { gte: since },
      ...(params.siteId ? { siteId: params.siteId } : {}),
    };

    const [totalAgg, byModel, byDay, recent] = await Promise.all([
      this.prisma.aiUsageLog.aggregate({
        where,
        _sum: { costCents: true, inputTokens: true, outputTokens: true },
        _count: true,
      }),
      this.prisma.aiUsageLog.groupBy({
        by: ['model'],
        where,
        _sum: { costCents: true, inputTokens: true, outputTokens: true },
        _count: true,
        orderBy: { _sum: { costCents: 'desc' } },
      }),
      this.prisma.$queryRaw<Array<{ day: Date; cost_cents: bigint; count: bigint }>>`
        SELECT date_trunc('day', created_at) AS day,
               SUM(cost_cents)::bigint     AS cost_cents,
               COUNT(*)::bigint            AS count
          FROM ai_usage_log
         WHERE created_at >= ${since}
           ${params.siteId ? require('@prisma/client').Prisma.sql`AND site_id = ${params.siteId}::uuid` : require('@prisma/client').Prisma.sql``}
         GROUP BY 1
         ORDER BY 1 ASC
      `,
      this.prisma.aiUsageLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: 20,
        select: {
          id: true,
          createdAt: true,
          model: true,
          inputTokens: true,
          outputTokens: true,
          costCents: true,
          cached: true,
          durationMs: true,
          siteId: true,
        },
      }),
    ]);

    return {
      since,
      days,
      total: {
        calls: totalAgg._count,
        costCents: totalAgg._sum.costCents ?? 0,
        inputTokens: totalAgg._sum.inputTokens ?? 0,
        outputTokens: totalAgg._sum.outputTokens ?? 0,
      },
      byModel: byModel.map((m) => ({
        model: m.model,
        calls: m._count,
        costCents: m._sum.costCents ?? 0,
        inputTokens: m._sum.inputTokens ?? 0,
        outputTokens: m._sum.outputTokens ?? 0,
      })),
      byDay: byDay.map((d) => ({
        day: d.day,
        costCents: Number(d.cost_cents),
        count: Number(d.count),
      })),
      recent,
    };
  }
}
