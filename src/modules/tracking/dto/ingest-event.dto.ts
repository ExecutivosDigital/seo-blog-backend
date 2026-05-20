import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsISO8601,
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';

/** Um evento de tracking. `name` deve estar no CATALOGO-EVENTOS.md. */
export class EventInput {
  @ApiProperty({ description: 'uuid gerado no client — idempotency key' })
  @IsString()
  @MaxLength(64)
  eventId!: string;

  @ApiProperty()
  @IsString()
  @MaxLength(128)
  sessionId!: string;

  @ApiProperty()
  @IsString()
  @MaxLength(128)
  anonymousId!: string;

  @ApiProperty({ example: 'cta_click' })
  @IsString()
  @MaxLength(64)
  name!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(2048)
  path?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(128)
  elementId?: string;

  @ApiPropertyOptional({ description: 'payload livre — sem PII, < 2KB' })
  @IsOptional()
  @IsObject()
  properties?: Record<string, unknown>;

  @ApiProperty({ description: 'timestamp do client (ISO 8601)' })
  @IsISO8601()
  occurredAt!: string;

  @ApiPropertyOptional({ default: 1 })
  @IsOptional()
  @IsInt()
  @Min(1)
  schemaVersion?: number;
}

/** Lote de eventos — o client agrupa para reduzir requests. */
export class IngestEventDto {
  @ApiProperty({ type: [EventInput] })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(50)
  @ValidateNested({ each: true })
  @Type(() => EventInput)
  events!: EventInput[];
}
