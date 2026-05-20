import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsOptional, IsString, MaxLength } from 'class-validator';

/**
 * Registro de decisão de consentimento (LGPD). Cada decisão do usuário gera
 * uma linha em tracking_consent_log — auditável. Ver docs/tracking/ Fase 3.
 */
export class IngestConsentDto {
  @ApiProperty()
  @IsString()
  @MaxLength(128)
  anonymousId!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(128)
  sessionId?: string;

  @ApiProperty()
  @IsBoolean()
  consentAnalytics!: boolean;

  @ApiProperty()
  @IsBoolean()
  consentMarketing!: boolean;

  @ApiProperty({ example: '2026-05-19-v1', description: 'versão do texto do banner' })
  @IsString()
  @MaxLength(64)
  consentVersion!: string;
}
