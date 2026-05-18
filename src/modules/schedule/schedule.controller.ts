import { Body, Controller, Delete, Get, HttpCode, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUserId } from '@/shared/decorators/CurrentUser.decorator';
import { RescheduleDto, ScheduleBulkDto, ScheduleOneDto } from './dto/schedule.dto';
import { ScheduleService } from './schedule.service';

@ApiTags('schedule')
@ApiBearerAuth()
@Controller('schedule')
export class ScheduleController {
  constructor(private service: ScheduleService) {}

  @Get()
  list(
    @Query('siteId') siteId?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    return this.service.list({ siteId, from, to });
  }

  @Post()
  @HttpCode(201)
  scheduleOne(@Body() dto: ScheduleOneDto, @CurrentUserId() userId: string) {
    return this.service.scheduleOne(dto, userId);
  }

  @Post('bulk')
  @HttpCode(201)
  scheduleBulk(@Body() dto: ScheduleBulkDto, @CurrentUserId() userId: string) {
    return this.service.scheduleBulk(dto, userId);
  }

  @Patch(':id')
  reschedule(@Param('id') id: string, @Body() dto: RescheduleDto) {
    return this.service.reschedule(id, dto);
  }

  @Delete(':id')
  cancel(@Param('id') id: string) {
    return this.service.cancel(id);
  }
}
