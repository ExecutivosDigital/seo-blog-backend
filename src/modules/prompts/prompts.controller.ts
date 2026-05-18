import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { PromptField } from '@prisma/client';
import { IsAdmin } from '@/shared/decorators/IsAdmin.decorator';
import { CreatePromptDto } from './dto/create-prompt.dto';
import { UpdatePromptDto } from './dto/update-prompt.dto';
import { PromptsService } from './prompts.service';

@ApiTags('prompts')
@ApiBearerAuth()
@Controller('prompts')
export class PromptsController {
  constructor(private service: PromptsService) {}

  @Get()
  list(
    @Query('siteId') siteId?: string,
    @Query('field') field?: PromptField,
    @Query('contentTypeId') contentTypeId?: string,
  ) {
    return this.service.list({ siteId, field, contentTypeId });
  }

  @Get(':id')
  get(@Param('id') id: string) {
    return this.service.get(id);
  }

  @Post()
  @IsAdmin()
  create(@Body() dto: CreatePromptDto) {
    return this.service.create(dto);
  }

  @Patch(':id')
  @IsAdmin()
  update(@Param('id') id: string, @Body() dto: UpdatePromptDto) {
    return this.service.update(id, dto);
  }

  @Delete(':id')
  @IsAdmin()
  remove(@Param('id') id: string) {
    return this.service.remove(id);
  }
}
