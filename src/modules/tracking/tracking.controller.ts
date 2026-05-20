import {
  Body,
  Controller,
  HttpCode,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiOperation, ApiSecurity, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { Request } from 'express';
import { IsPublic } from '@/shared/decorators/IsPublic.decorator';
import { CurrentTrackingSite } from './decorators/current-tracking-site.decorator';
import { IngestConsentDto } from './dto/ingest-consent.dto';
import { IngestEventDto } from './dto/ingest-event.dto';
import { IngestLeadDto } from './dto/ingest-lead.dto';
import { IngestSessionDto } from './dto/ingest-session.dto';
import { SiteKeyGuard, TrackingSiteContext } from './guards/site-key.guard';
import { TrackingService } from './tracking.service';
import { requestContext } from './tracking.util';

/**
 * Endpoints públicos de ingestão do hub de tracking.
 * Autenticação: header `X-Site-Key` (publicKey do site) via SiteKeyGuard.
 * São `@IsPublic()` para o AuthGuard JWT global liberar — a autorização real
 * é o SiteKeyGuard. Ver docs/tracking/ARQUITETURA-TRACKING.md §3.1.
 *
 * Rate-limit: por IP (ThrottlerGuard global, limites ampliados aqui para
 * acomodar bursts legítimos de tracking). Rate-limit por sessionId/siteId é
 * refinamento previsto — ver docs/tracking/PONTOS-ATENCAO-TRACKING.md.
 */
@ApiTags('tracking')
@ApiSecurity('X-Site-Key')
@Controller('tracking')
@UseGuards(SiteKeyGuard)
@IsPublic()
@Throttle({
  short: { limit: 100, ttl: 10_000 },
  medium: { limit: 1_000, ttl: 60_000 },
  long: { limit: 5_000, ttl: 300_000 },
})
export class TrackingController {
  constructor(private service: TrackingService) {}

  @Post('session')
  @HttpCode(204)
  @ApiOperation({ summary: 'Cria/atualiza sessão (idempotente por sessionId)' })
  async session(
    @CurrentTrackingSite() site: TrackingSiteContext,
    @Body() dto: IngestSessionDto,
    @Req() req: Request,
  ): Promise<void> {
    await this.service.ingestSession(site.id, dto, requestContext(req));
  }

  @Post('event')
  @HttpCode(202)
  @ApiOperation({ summary: 'Ingere lote de eventos (idempotente por eventId)' })
  async event(
    @CurrentTrackingSite() site: TrackingSiteContext,
    @Body() dto: IngestEventDto,
  ): Promise<{ accepted: number; failed: number }> {
    return this.service.ingestEvents(site.id, dto);
  }

  @Post('lead')
  @HttpCode(200)
  @ApiOperation({ summary: 'Registra lead (idempotente por janela curta)' })
  async lead(
    @CurrentTrackingSite() site: TrackingSiteContext,
    @Body() dto: IngestLeadDto,
    @Req() req: Request,
  ): Promise<{ leadId: string; deduplicated: boolean }> {
    return this.service.ingestLead(site.id, dto, requestContext(req));
  }

  @Post('consent')
  @HttpCode(204)
  @ApiOperation({ summary: 'Registra decisão de consentimento (LGPD)' })
  async consent(
    @CurrentTrackingSite() site: TrackingSiteContext,
    @Body() dto: IngestConsentDto,
    @Req() req: Request,
  ): Promise<void> {
    await this.service.ingestConsent(site.id, dto, requestContext(req));
  }
}
