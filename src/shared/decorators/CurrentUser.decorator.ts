import { ExecutionContext, UnauthorizedException, createParamDecorator } from '@nestjs/common';

export interface CurrentUserPayload {
  sub: string;
  email: string;
  name: string;
  role: string;
}

export const CurrentUser = createParamDecorator<undefined>(
  (_: undefined, context: ExecutionContext): CurrentUserPayload => {
    const request = context.switchToHttp().getRequest();
    if (!request.adminAuth) {
      throw new UnauthorizedException('Authorization required');
    }
    return request.adminAuth as CurrentUserPayload;
  },
);

export const CurrentUserId = createParamDecorator<undefined>(
  (_: undefined, context: ExecutionContext): string => {
    const request = context.switchToHttp().getRequest();
    if (!request.adminAuth?.sub) {
      throw new UnauthorizedException('Authorization required');
    }
    return request.adminAuth.sub as string;
  },
);
