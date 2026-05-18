import { Body, Controller, Delete, Get, Param, Patch, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { IsAdmin } from '@/shared/decorators/IsAdmin.decorator';
import { CreateSiteDto } from './dto/create-site.dto';
import { UpdateSiteDto } from './dto/update-site.dto';
import { SitesService } from './sites.service';

@ApiTags('sites')
@ApiBearerAuth()
@Controller('sites')
export class SitesController {
  constructor(private service: SitesService) {}

  @Get()
  list() {
    return this.service.list();
  }

  @Get(':id')
  get(@Param('id') id: string) {
    return this.service.get(id);
  }

  @Post()
  @IsAdmin()
  create(@Body() dto: CreateSiteDto) {
    return this.service.create(dto);
  }

  @Patch(':id')
  @IsAdmin()
  update(@Param('id') id: string, @Body() dto: UpdateSiteDto) {
    return this.service.update(id, dto);
  }

  @Delete(':id')
  @IsAdmin()
  remove(@Param('id') id: string) {
    return this.service.remove(id);
  }
}
