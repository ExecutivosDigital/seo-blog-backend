import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { ArrayMaxSize, ArrayMinSize, IsArray, ValidateNested } from 'class-validator';
import { CreateIdeaDto } from './create-idea.dto';

export class BulkCreateIdeasDto {
  @ApiProperty({ type: [CreateIdeaDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(1000)
  @ValidateNested({ each: true })
  @Type(() => CreateIdeaDto)
  items!: CreateIdeaDto[];
}
