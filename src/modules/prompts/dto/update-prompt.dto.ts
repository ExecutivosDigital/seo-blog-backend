import { OmitType, PartialType } from '@nestjs/swagger';
import { CreatePromptDto } from './create-prompt.dto';

export class UpdatePromptDto extends PartialType(
  OmitType(CreatePromptDto, ['siteId'] as const),
) {}
