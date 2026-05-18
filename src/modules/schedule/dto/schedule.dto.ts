import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsDateString,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  Min,
} from 'class-validator';

export class ScheduleOneDto {
  @ApiProperty()
  @IsUUID()
  contentId!: string;

  @ApiProperty({ description: 'ISO 8601' })
  @IsDateString()
  scheduledFor!: string;
}

export class RescheduleDto {
  @ApiProperty()
  @IsDateString()
  scheduledFor!: string;
}

export enum SchedulingMode {
  DAILY = 'DAILY',
  WEEKLY = 'WEEKLY',
  EVERY_N_DAYS = 'EVERY_N_DAYS',
}

export class ScheduleBulkDto {
  @ApiProperty({ type: [String] })
  @IsArray()
  @ArrayMinSize(1)
  @IsUUID('all', { each: true })
  contentIds!: string[];

  @ApiProperty({ description: 'Data ISO da 1ª publicação (YYYY-MM-DD ou full)' })
  @IsDateString()
  startDate!: string;

  @ApiPropertyOptional({ description: 'Hora HH:MM no fuso de São Paulo (default 09:00)' })
  @IsOptional()
  @Matches(/^\d{2}:\d{2}$/)
  time?: string;

  @ApiProperty({ enum: SchedulingMode, default: SchedulingMode.DAILY })
  @IsEnum(SchedulingMode)
  mode!: SchedulingMode;

  @ApiPropertyOptional({ description: 'Intervalo em dias (para EVERY_N_DAYS)' })
  @IsOptional()
  @IsInt()
  @Min(1)
  everyN?: number;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  skipWeekends?: boolean;

  @ApiPropertyOptional({
    description: 'Timezone IANA (default America/Sao_Paulo)',
  })
  @IsOptional()
  @IsString()
  timezone?: string;
}
