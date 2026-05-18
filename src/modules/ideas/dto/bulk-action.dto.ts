import { ApiProperty } from '@nestjs/swagger';
import { ArrayMinSize, IsArray, IsOptional, IsUUID } from 'class-validator';

export class BulkIdsDto {
  @ApiProperty({ type: [String] })
  @IsArray()
  @ArrayMinSize(1)
  @IsUUID('all', { each: true })
  ids!: string[];
}

export class BulkMoveTypeDto extends BulkIdsDto {
  @ApiProperty()
  @IsUUID()
  contentTypeId!: string;
}

export class BulkUpdateStatusDto extends BulkIdsDto {
  @ApiProperty({ enum: ['PENDING', 'EXPANDED', 'DISCARDED'] })
  @IsOptional()
  status!: 'PENDING' | 'EXPANDED' | 'DISCARDED';
}
