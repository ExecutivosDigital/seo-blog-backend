import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '@/shared/database/prisma/prisma.service';
import { EnvService } from '@/shared/env/env.service';
import { IngestConsentDto } from './dto/ingest-consent.dto';
import { IngestEventDto } from './dto/ingest-event.dto';
import { IngestLeadDto } from './dto/ingest-lead.dto';
import { IngestSessionDto, AttributionInput } from './dto/ingest-session.dto';
import {
  RequestContext,
  detectBot,
  detectDeviceType,
  hashIp,
  leadDedupeHash,
} from './tracking.util';

/** Janela de deduplicação de lead — replay dentro desse intervalo reaproveita o lead. */
const LEAD_DEDUPE_WINDOW_MS = 5 * 60 * 1000;

@Injectable()
export class TrackingService {
  private readonly logger = new Logger(TrackingService.name);
  private readonly ipSalt: string;

  constructor(
    private prisma: PrismaService,
    env: EnvService,
  ) {
    this.ipSalt = env.get('TRACKING_IP_SALT') ?? '';
  }

  /**
   * Cria/atualiza a sessão. Idempotente por `sessionId`: chamadas repetidas
   * só atualizam `lastSeenAt` (heartbeat). A atribuição é first-touch imutável.
   */
  async ingestSession(
    siteId: string,
    dto: IngestSessionDto,
    ctx: RequestContext,
  ): Promise<void> {
    await this.prisma.trackingSession.upsert({
      where: { sessionId: dto.sessionId },
      create: {
        siteId,
        anonymousId: dto.anonymousId,
        sessionId: dto.sessionId,
        startedAt: dto.startedAt ? new Date(dto.startedAt) : undefined,
        lastSeenAt: new Date(),
        firstReferrer: dto.referrer ?? dto.attribution?.referrer,
        firstLandingPath: dto.landingPath,
        userAgent: ctx.userAgent,
        deviceType: detectDeviceType(ctx.userAgent),
        locale: dto.locale,
        ipHash: hashIp(ctx.ip, this.ipSalt),
        isBot: detectBot(ctx.userAgent),
      },
      update: { lastSeenAt: new Date() },
    });

    if (dto.attribution && this.hasAttribution(dto.attribution)) {
      await this.prisma.trackingAttribution.upsert({
        where: { sessionId: dto.sessionId },
        create: {
          sessionId: dto.sessionId,
          siteId,
          anonymousId: dto.anonymousId,
          utmSource: dto.attribution.utmSource,
          utmMedium: dto.attribution.utmMedium,
          utmCampaign: dto.attribution.utmCampaign,
          utmTerm: dto.attribution.utmTerm,
          utmContent: dto.attribution.utmContent,
          gclid: dto.attribution.gclid,
          fbclid: dto.attribution.fbclid,
          referrer: dto.attribution.referrer ?? dto.referrer,
          landingPath: dto.landingPath,
        },
        update: {}, // first-touch é imutável — replay não sobrescreve
      });
    }
  }

  /**
   * Ingere um lote de eventos. Idempotente por `eventId` (upsert no-op em replay).
   * Um item que falhe no banco não derruba o lote inteiro.
   */
  async ingestEvents(
    siteId: string,
    dto: IngestEventDto,
  ): Promise<{ accepted: number; failed: number }> {
    // Garante que exista uma linha de sessão para cada sessionId do lote —
    // analytics sempre consegue fazer join. Sem FK: ordem de chegada não importa (R10).
    const sessions = new Map<string, string>();
    for (const ev of dto.events) sessions.set(ev.sessionId, ev.anonymousId);
    await Promise.allSettled(
      [...sessions].map(([sessionId, anonymousId]) =>
        this.prisma.trackingSession.upsert({
          where: { sessionId },
          create: { siteId, anonymousId, sessionId, lastSeenAt: new Date() },
          update: { lastSeenAt: new Date() },
        }),
      ),
    );

    const results = await Promise.allSettled(
      dto.events.map((ev) =>
        this.prisma.trackingEvent.upsert({
          where: { eventId: ev.eventId },
          create: {
            eventId: ev.eventId,
            siteId,
            sessionId: ev.sessionId,
            anonymousId: ev.anonymousId,
            name: ev.name,
            path: ev.path,
            elementId: ev.elementId,
            properties: (ev.properties ?? {}) as Prisma.InputJsonValue,
            occurredAt: new Date(ev.occurredAt),
            schemaVersion: ev.schemaVersion ?? 1,
          },
          update: {}, // replay do mesmo eventId é no-op
        }),
      ),
    );

    const failed = results.filter((r) => r.status === 'rejected');
    for (const f of failed) {
      this.logger.warn(`Falha ao ingerir evento: ${(f as PromiseRejectedResult).reason}`);
    }
    return { accepted: dto.events.length - failed.length, failed: failed.length };
  }

  /**
   * Registra um lead. Idempotente por hash(siteId+email+phone) numa janela curta —
   * replay devolve o lead já existente em vez de duplicar.
   */
  async ingestLead(
    siteId: string,
    dto: IngestLeadDto,
    ctx: RequestContext,
  ): Promise<{ leadId: string; deduplicated: boolean }> {
    if (!dto.email && !dto.phone) {
      throw new BadRequestException('Lead requires email or phone');
    }

    const dedupeHash = leadDedupeHash(siteId, dto.email, dto.phone);
    const since = new Date(Date.now() - LEAD_DEDUPE_WINDOW_MS);
    const existing = await this.prisma.trackingLead.findFirst({
      where: { siteId, dedupeHash, createdAt: { gte: since } },
      orderBy: { createdAt: 'desc' },
      select: { id: true },
    });
    if (existing) return { leadId: existing.id, deduplicated: true };

    const lead = await this.prisma.trackingLead.create({
      data: {
        siteId,
        sessionId: dto.sessionId,
        anonymousId: dto.anonymousId,
        name: dto.name,
        email: dto.email?.toLowerCase().trim(),
        phone: dto.phone?.trim(),
        source: dto.source,
        buttonId: dto.buttonId,
        destination: dto.destination,
        sourceUrl: dto.sourceUrl,
        utmSource: dto.utmSource,
        utmMedium: dto.utmMedium,
        utmCampaign: dto.utmCampaign,
        payload: (dto.payload ?? {}) as Prisma.InputJsonValue,
        consentLgpd: dto.consentLgpd ?? false,
        dedupeHash,
        ipHash: hashIp(ctx.ip, this.ipSalt),
      },
      select: { id: true },
    });
    return { leadId: lead.id, deduplicated: false };
  }

  /** Registra uma decisão de consentimento (auditoria LGPD). */
  async ingestConsent(
    siteId: string,
    dto: IngestConsentDto,
    ctx: RequestContext,
  ): Promise<void> {
    await this.prisma.trackingConsentLog.create({
      data: {
        siteId,
        anonymousId: dto.anonymousId,
        sessionId: dto.sessionId,
        consentAnalytics: dto.consentAnalytics,
        consentMarketing: dto.consentMarketing,
        consentVersion: dto.consentVersion,
        ipHash: hashIp(ctx.ip, this.ipSalt),
        userAgent: ctx.userAgent,
      },
    });
  }

  private hasAttribution(a: AttributionInput): boolean {
    return Boolean(
      a.utmSource ||
        a.utmMedium ||
        a.utmCampaign ||
        a.utmTerm ||
        a.utmContent ||
        a.gclid ||
        a.fbclid ||
        a.referrer,
    );
  }
}
