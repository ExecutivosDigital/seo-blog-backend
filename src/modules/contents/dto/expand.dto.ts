import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { PromptField } from '@prisma/client';
import {
  IsArray,
  IsBoolean,
  IsEnum,
  IsOptional,
  IsString,
  IsUUID,
} from 'class-validator';

export class ExpandIdeaDto {
  @ApiProperty()
  @IsUUID()
  ideaId!: string;

  @ApiPropertyOptional({ description: 'Gerar imagem de capa também?', default: true })
  @IsOptional()
  @IsBoolean()
  generateImage?: boolean;

  @ApiPropertyOptional({
    description: 'Lista de campos a expandir. Default: todos os principais.',
    enum: PromptField,
    isArray: true,
  })
  @IsOptional()
  @IsArray()
  @IsEnum(PromptField, { each: true })
  fields?: PromptField[];
}

export class RegenerateFieldDto {
  @ApiProperty({ enum: PromptField })
  @IsEnum(PromptField)
  field!: PromptField;

  @ApiPropertyOptional({ description: 'Variáveis adicionais para o prompt' })
  @IsOptional()
  variables?: Record<string, unknown>;

  @ApiPropertyOptional({ description: 'Não gravar — só retornar o resultado', default: false })
  @IsOptional()
  @IsBoolean()
  preview?: boolean;
}

export class GenerateCoverDto {
  @ApiPropertyOptional({ description: 'Override do prompt; se não passado, gera primeiro via IA' })
  @IsOptional()
  @IsString()
  prompt?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  model?: string;
}

export class TransitionDto {
  @ApiProperty({ enum: ['DRAFT', 'EXPANDED', 'APPROVED', 'SCHEDULED', 'PUBLISHED', 'UNPUBLISHED', 'ARCHIVED'] })
  @IsString()
  to!: string;
}
