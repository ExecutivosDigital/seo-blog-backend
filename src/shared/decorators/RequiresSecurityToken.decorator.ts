import { SetMetadata } from '@nestjs/common';

export const REQUIRES_SECURITY_TOKEN_KEY = 'requiresSecurityToken';
export const RequiresSecurityToken = () => SetMetadata(REQUIRES_SECURITY_TOKEN_KEY, true);
