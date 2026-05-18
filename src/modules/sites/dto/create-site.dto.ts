import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsObject,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';

export class CreateSiteDto {
  @ApiProperty({ example: 'health-voice' })
  @IsString()
  @Matches(/^[a-z0-9-]+$/, { message: 'slug must be kebab-case lowercase' })
  @MinLength(2)
  @MaxLength(60)
  slug!: string;

  @ApiProperty({ example: 'Health Voice' })
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  name!: string;

  @ApiPropertyOptional({ example: 'healthvoice.com.br' })
  @IsOptional()
  @IsString()
  domain?: string;

  @ApiProperty({ example: 'Health Voice', description: 'autor visível dos posts' })
  @IsString()
  @MinLength(1)
  authorName!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  toneOfVoice?: string;

  @ApiPropertyOptional({ default: 'pt-BR' })
  @IsOptional()
  @IsString()
  defaultLocale?: string;

  @ApiPropertyOptional({ type: [String], default: ['pt-BR'] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  supportedLocales?: string[];

  @ApiPropertyOptional({ type: Object })
  @IsOptional()
  @IsObject()
  @Type(() => Object)
  ogDefaults?: Record<string, unknown>;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  indexnowKey?: string;

  @ApiPropertyOptional({ description: 'URL do endpoint /api/revalidate da LP' })
  @IsOptional()
  @IsString()
  revalidateUrl?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  revalidateSecret?: string;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  active?: boolean;
}
