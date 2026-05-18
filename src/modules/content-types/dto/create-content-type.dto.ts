import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';

export class CreateContentTypeDto {
  @ApiProperty()
  @IsUUID()
  siteId!: string;

  @ApiProperty({ example: 'blog' })
  @IsString()
  @Matches(/^[a-z0-9-]+$/)
  @MinLength(2)
  @MaxLength(40)
  slug!: string;

  @ApiProperty({ example: 'Blog' })
  @IsString()
  @MinLength(1)
  name!: string;

  @ApiProperty({ example: '/blog' })
  @IsString()
  @Matches(/^\//)
  routePrefix!: string;

  @ApiPropertyOptional({ type: Object })
  @IsOptional()
  @IsObject()
  @Type(() => Object)
  schemaExtra?: Record<string, unknown>;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  active?: boolean;
}
