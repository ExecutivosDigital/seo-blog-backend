import { OmitType, PartialType } from '@nestjs/swagger';
import { CreateIdeaDto } from './create-idea.dto';

export class UpdateIdeaDto extends PartialType(
  OmitType(CreateIdeaDto, ['siteId'] as const),
) {}
