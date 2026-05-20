import { Module } from '@nestjs/common';
import { TrackingController } from './tracking.controller';
import { TrackingService } from './tracking.service';

/**
 * Hub de tracking — ingestão de comportamento de usuários das LPs.
 * Distinto do módulo `metrics` (que mede a operação do CMS).
 * PrismaService e EnvService vêm de módulos @Global.
 * Endpoints de analytics (privados, para o dashboard) entram numa fase futura.
 */
@Module({
  controllers: [TrackingController],
  providers: [TrackingService],
  exports: [TrackingService],
})
export class TrackingModule {}
