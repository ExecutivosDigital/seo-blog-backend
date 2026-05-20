import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '@/shared/database/prisma/prisma.service';

/**
 * Agregações de analytics para o dashboard (rotas privadas /admin/analytics).
 * Toda agregação é feita no banco — o front recebe dado pronto.
 * Ver docs/tracking/ARQUITETURA-TRACKING.md §3.2 e §7.
 *
 * Nota v1: não filtra bots (`tracking_sessions.is_bot`). Decisão DP6 pendente —
 * ver docs/tracking/PONTOS-ATENCAO-TRACKING.md.
 */
@Injectable()
export class AnalyticsService {
  constructor(private prisma: PrismaService) {}

  /** Cards do overview — período atual + período anterior (para o ▲▼ %). */
  async overview(params: { siteId?: string; days?: number }) {
    const days = params.days ?? 30;
    const now = new Date();
    const since = new Date(now.getTime() - days * 86_400_000);
    const prevSince = new Date(now.getTime() - 2 * days * 86_400_000);

    const [current, previous] = await Promise.all([
      this.windowMetrics(params.siteId, since, now),
      this.windowMetrics(params.siteId, prevSince, since),
    ]);

    return { range: { since, days }, current, previous };
  }

  private async windowMetrics(siteId: string | undefined, from: Date, to: Date) {
    const siteFilter = siteId ? { siteId } : {};
    const [sessions, pageViews, events, leads] = await Promise.all([
      this.prisma.trackingSession.count({
        where: { ...siteFilter, startedAt: { gte: from, lt: to } },
      }),
      this.prisma.trackingEvent.count({
        where: { ...siteFilter, name: 'page_view', occurredAt: { gte: from, lt: to } },
      }),
      this.prisma.trackingEvent.count({
        where: { ...siteFilter, occurredAt: { gte: from, lt: to } },
      }),
      this.prisma.trackingLead.count({
        where: { ...siteFilter, createdAt: { gte: from, lt: to } },
      }),
    ]);
    const conversionRate =
      sessions > 0 ? Math.round((leads / sessions) * 10_000) / 100 : 0;
    return { sessions, pageViews, events, leads, conversionRate };
  }

  /** Série diária de sessões, page views e leads. */
  async timeseries(params: { siteId?: string; days?: number }) {
    const days = params.days ?? 30;
    const since = new Date(Date.now() - days * 86_400_000);
    const site = params.siteId
      ? Prisma.sql`AND site_id = ${params.siteId}::uuid`
      : Prisma.sql``;

    const [sessions, pageViews, leads] = await Promise.all([
      this.prisma.$queryRaw<Array<{ day: Date; n: bigint }>>`
        SELECT date_trunc('day', started_at) AS day, COUNT(*)::bigint AS n
          FROM tracking_sessions
         WHERE started_at >= ${since} ${site}
         GROUP BY 1 ORDER BY 1 ASC`,
      this.prisma.$queryRaw<Array<{ day: Date; n: bigint }>>`
        SELECT date_trunc('day', occurred_at) AS day, COUNT(*)::bigint AS n
          FROM tracking_events
         WHERE name = 'page_view' AND occurred_at >= ${since} ${site}
         GROUP BY 1 ORDER BY 1 ASC`,
      this.prisma.$queryRaw<Array<{ day: Date; n: bigint }>>`
        SELECT date_trunc('day', created_at) AS day, COUNT(*)::bigint AS n
          FROM tracking_leads
         WHERE created_at >= ${since} ${site}
         GROUP BY 1 ORDER BY 1 ASC`,
    ]);

    const byDay = new Map<
      string,
      { day: string; sessions: number; pageViews: number; leads: number }
    >();
    const bucket = (day: Date) => {
      const key = day.toISOString().slice(0, 10);
      if (!byDay.has(key))
        byDay.set(key, { day: key, sessions: 0, pageViews: 0, leads: 0 });
      return byDay.get(key)!;
    };
    for (const r of sessions) bucket(r.day).sessions = Number(r.n);
    for (const r of pageViews) bucket(r.day).pageViews = Number(r.n);
    for (const r of leads) bucket(r.day).leads = Number(r.n);

    return {
      since,
      days,
      series: [...byDay.values()].sort((a, b) => a.day.localeCompare(b.day)),
    };
  }

  /** Funil de conversão: nº de sessões distintas que atingiram cada etapa. */
  async funnel(params: { siteId?: string; days?: number }) {
    const days = params.days ?? 30;
    const since = new Date(Date.now() - days * 86_400_000);
    const site = params.siteId
      ? Prisma.sql`AND site_id = ${params.siteId}::uuid`
      : Prisma.sql``;

    const [row] = await this.prisma.$queryRaw<
      Array<Record<string, bigint>>
    >`
      SELECT
        COUNT(DISTINCT session_id) FILTER (WHERE name = 'page_view')    AS page_view,
        COUNT(DISTINCT session_id) FILTER (WHERE name = 'cta_click')    AS cta_click,
        COUNT(DISTINCT session_id) FILTER (WHERE name = 'form_view')    AS form_view,
        COUNT(DISTINCT session_id) FILTER (WHERE name = 'form_submit')  AS form_submit,
        COUNT(DISTINCT session_id) FILTER (WHERE name = 'lead_created') AS lead_created
        FROM tracking_events
       WHERE occurred_at >= ${since} ${site}`;

    const defs: Array<{ key: string; label: string }> = [
      { key: 'page_view', label: 'Visitou a página' },
      { key: 'cta_click', label: 'Clicou num CTA' },
      { key: 'form_view', label: 'Viu o formulário' },
      { key: 'form_submit', label: 'Enviou o formulário' },
      { key: 'lead_created', label: 'Virou lead' },
    ];
    const top = Number(row?.page_view ?? 0n);
    let prev = top;

    const steps = defs.map((d, i) => {
      const sessions = Number(row?.[d.key] ?? 0n);
      const ofTop = top > 0 ? Math.round((sessions / top) * 1000) / 10 : 0;
      const ofPrev =
        i === 0 || prev === 0 ? 100 : Math.round((sessions / prev) * 1000) / 10;
      prev = sessions;
      return { step: d.key, label: d.label, sessions, pctOfTop: ofTop, pctOfPrev: ofPrev };
    });

    return { since, days, steps };
  }

  /** Atribuição: sessões e leads por utm_source (com taxa de conversão). */
  async attribution(params: { siteId?: string; days?: number }) {
    const days = params.days ?? 30;
    const since = new Date(Date.now() - days * 86_400_000);
    const siteFilter = params.siteId ? { siteId: params.siteId } : {};

    const [sessionsBy, leadsBy] = await Promise.all([
      this.prisma.trackingAttribution.groupBy({
        by: ['utmSource'],
        where: { ...siteFilter, createdAt: { gte: since } },
        _count: true,
      }),
      this.prisma.trackingLead.groupBy({
        by: ['utmSource'],
        where: { ...siteFilter, createdAt: { gte: since } },
        _count: true,
      }),
    ]);

    const rows = new Map<string, { source: string; sessions: number; leads: number }>();
    const row = (src: string | null) => {
      const key = src ?? '(direto / sem utm)';
      if (!rows.has(key)) rows.set(key, { source: key, sessions: 0, leads: 0 });
      return rows.get(key)!;
    };
    for (const s of sessionsBy) row(s.utmSource).sessions = s._count;
    for (const l of leadsBy) row(l.utmSource).leads = l._count;

    const bySource = [...rows.values()]
      .map((r) => ({
        ...r,
        conversionRate:
          r.sessions > 0 ? Math.round((r.leads / r.sessions) * 10_000) / 100 : 0,
      }))
      .sort((a, b) => b.leads - a.leads || b.sessions - a.sessions);

    return { since, days, bySource };
  }

  /** Lista paginada de leads (drill-down). */
  async leads(params: {
    siteId?: string;
    days?: number;
    page?: number;
    pageSize?: number;
  }) {
    const days = params.days ?? 30;
    const since = new Date(Date.now() - days * 86_400_000);
    const page = Math.max(1, params.page ?? 1);
    const pageSize = Math.min(100, Math.max(1, params.pageSize ?? 20));
    const where: Prisma.TrackingLeadWhereInput = {
      createdAt: { gte: since },
      ...(params.siteId ? { siteId: params.siteId } : {}),
    };

    const [total, items] = await Promise.all([
      this.prisma.trackingLead.count({ where }),
      this.prisma.trackingLead.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
        select: {
          id: true,
          name: true,
          email: true,
          phone: true,
          source: true,
          utmSource: true,
          utmCampaign: true,
          status: true,
          createdAt: true,
        },
      }),
    ]);

    return { total, page, pageSize, pages: Math.ceil(total / pageSize), items };
  }
}
