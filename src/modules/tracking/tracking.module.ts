import { Module } from '@nestjs/common';
import { AnalyticsController } from './analytics.controller';
import { AnalyticsService } from './analytics.service';
import { TrackingController } from './tracking.controller';
import { TrackingService } from './tracking.service';

/**
 * Hub de tracking — ingestão de comportamento de usuários das LPs.
 * Distinto do módulo `metrics` (que mede a operação do CMS).
 * PrismaService e EnvService vêm de módulos @Global.
 *
 * - TrackingController: ingestão pública (X-Site-Key).
 * - AnalyticsController: agregações privadas /admin/analytics (JWT).
 */
@Module({
  controllers: [TrackingController, AnalyticsController],
  providers: [TrackingService, AnalyticsService],
  exports: [TrackingService, AnalyticsService],
})
export class TrackingModule {}
