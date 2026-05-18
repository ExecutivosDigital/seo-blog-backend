import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsArray,
  IsEnum,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  MinLength,
} from 'class-validator';
import { IdeaStatus } from '@prisma/client';

export class CreateIdeaDto {
  @ApiProperty()
  @IsUUID()
  siteId!: string;

  @ApiProperty()
  @IsUUID()
  contentTypeId!: string;

  @ApiProperty({ minLength: 3, maxLength: 240 })
  @IsString()
  @MinLength(3)
  @MaxLength(240)
  titleSeed!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  briefing?: string;

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  keywords?: string[];

  @ApiPropertyOptional({ default: 'pt-BR' })
  @IsOptional()
  @IsString()
  locale?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  notes?: string;

  @ApiPropertyOptional({ enum: IdeaStatus })
  @IsOptional()
  @IsEnum(IdeaStatus)
  status?: IdeaStatus;
}
