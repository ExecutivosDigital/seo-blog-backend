import { Controller, Get, HttpCode, Param, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { PublishJobStatus } from '@prisma/client';
import { CurrentUserId } from '@/shared/decorators/CurrentUser.decorator';
import { PublishService } from './publish.service';

@ApiTags('publish')
@ApiBearerAuth()
@Controller()
export class PublishController {
  constructor(private service: PublishService) {}

  @Get('publish-jobs')
  list(
    @Query('siteId') siteId?: string,
    @Query('status') status?: PublishJobStatus,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
  ) {
    return this.service.listAll({
      siteId,
      status,
      page: page ? Number(page) : undefined,
      pageSize: pageSize ? Number(pageSize) : undefined,
    });
  }

  @Post('contents/:id/publish-now')
  @HttpCode(202)
  publishNow(@Param('id') id: string, @CurrentUserId() userId: string) {
    return this.service.publishNow(id, userId);
  }

  @Post('publish-jobs/:id/retry')
  @HttpCode(202)
  retry(@Param('id') id: string) {
    return this.service.retry(id);
  }
}
