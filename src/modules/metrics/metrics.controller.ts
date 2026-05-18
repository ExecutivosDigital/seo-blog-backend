import { Controller, Get, Header, Query, Res } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Response } from 'express';
import { MetricsService } from './metrics.service';

@ApiTags('metrics')
@ApiBearerAuth()
@Controller('metrics')
export class MetricsController {
  constructor(private service: MetricsService) {}

  @Get('overview')
  overview(@Query('siteId') siteId?: string) {
    return this.service.overview(siteId);
  }

  @Get('ai-cost')
  aiCost(@Query('siteId') siteId?: string, @Query('days') days?: string) {
    return this.service.aiCost({
      siteId,
      days: days ? Number(days) : undefined,
    });
  }

  @Get('publish-stats')
  publishStats(@Query('siteId') siteId?: string, @Query('days') days?: string) {
    return this.service.publishStats({
      siteId,
      days: days ? Number(days) : undefined,
    });
  }

  @Get('ai-cost/export.csv')
  @Header('Content-Type', 'text/csv; charset=utf-8')
  @Header('Content-Disposition', 'attachment; filename=ai-cost.csv')
  async exportCsv(
    @Res() res: Response,
    @Query('siteId') siteId?: string,
    @Query('days') days?: string,
  ) {
    const csv = await this.service.aiCostCsv({
      siteId,
      days: days ? Number(days) : undefined,
    });
    res.send(csv);
  }
}
