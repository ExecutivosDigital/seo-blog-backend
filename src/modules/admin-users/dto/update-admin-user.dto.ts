import { OmitType, PartialType } from '@nestjs/swagger';
import { CreateAdminUserDto } from './create-admin-user.dto';

export class UpdateAdminUserDto extends PartialType(
  OmitType(CreateAdminUserDto, ['password'] as const),
) {}
