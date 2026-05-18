import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { PromptField } from '@prisma/client';
import {
  IsBoolean,
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  Min,
  MinLength,
} from 'class-validator';

export class CreatePromptDto {
  @ApiProperty()
  @IsUUID()
  siteId!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  contentTypeId?: string;

  @ApiProperty({ enum: PromptField })
  @IsEnum(PromptField)
  field!: PromptField;

  @ApiPropertyOptional({ default: 'pt-BR' })
  @IsOptional()
  @IsString()
  locale?: string;

  @ApiProperty()
  @IsString()
  @MinLength(1)
  model!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  systemPrompt?: string;

  @ApiProperty()
  @IsString()
  @MinLength(1)
  userPrompt!: string;

  @ApiPropertyOptional({ default: 0.7, minimum: 0, maximum: 2 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(2)
  temperature?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(1)
  maxTokens?: number;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  active?: boolean;
}
