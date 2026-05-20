import { Controller, Get, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AnalyticsService } from './analytics.service';

/**
 * Endpoints privados de analytics — consumidos pelo dashboard do painel admin.
 * Protegidos pelo AuthGuard JWT global (não são @IsPublic).
 * `siteId` opcional: ausente = todos os sites. Ver ARQUITETURA §3.2.
 */
@ApiTags('analytics')
@ApiBearerAuth()
@Controller('admin/analytics')
export class AnalyticsController {
  constructor(private service: AnalyticsService) {}

  @Get('overview')
  @ApiOperation({ summary: 'Cards do overview — período atual vs. anterior' })
  overview(@Query('siteId') siteId?: string, @Query('days') days?: string) {
    return this.service.overview({ siteId, days: days ? Number(days) : undefined });
  }

  @Get('timeseries')
  @ApiOperation({ summary: 'Série diária de sessões, page views e leads' })
  timeseries(@Query('siteId') siteId?: string, @Query('days') days?: string) {
    return this.service.timeseries({ siteId, days: days ? Number(days) : undefined });
  }

  @Get('funnel')
  @ApiOperation({ summary: 'Funil de conversão page_view → lead_created' })
  funnel(@Query('siteId') siteId?: string, @Query('days') days?: string) {
    return this.service.funnel({ siteId, days: days ? Number(days) : undefined });
  }

  @Get('attribution')
  @ApiOperation({ summary: 'Sessões e leads por utm_source' })
  attribution(@Query('siteId') siteId?: string, @Query('days') days?: string) {
    return this.service.attribution({ siteId, days: days ? Number(days) : undefined });
  }

  @Get('leads')
  @ApiOperation({ summary: 'Lista paginada de leads (drill-down)' })
  leads(
    @Query('siteId') siteId?: string,
    @Query('days') days?: string,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
  ) {
    return this.service.leads({
      siteId,
      days: days ? Number(days) : undefined,
      page: page ? Number(page) : undefined,
      pageSize: pageSize ? Number(pageSize) : undefined,
    });
  }
}
