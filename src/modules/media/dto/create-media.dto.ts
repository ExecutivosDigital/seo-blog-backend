import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, IsUUID } from 'class-validator';

export class CreateMediaDto {
  @ApiProperty()
  @IsUUID()
  siteId!: string;

  @ApiProperty({ description: 'URL externa (Unsplash, Freepik) ou upload pré-feito' })
  @IsString()
  url!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  alt?: string;
}

export class GenerateMediaDto {
  @ApiProperty()
  @IsUUID()
  siteId!: string;

  @ApiProperty({ description: 'Texto do prompt' })
  @IsString()
  prompt!: string;

  @ApiPropertyOptional({ description: 'Modelo OpenRouter (override do default)' })
  @IsOptional()
  @IsString()
  model?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  alt?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  contentId?: string;
}

export class UploadMediaDto {
  @ApiProperty()
  @IsUUID()
  siteId!: string;

  @ApiProperty({ description: 'Conteúdo base64 (data URI ou raw)' })
  @IsString()
  base64!: string;

  @ApiProperty()
  @IsString()
  fileName!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  mimeType?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  alt?: string;
}
