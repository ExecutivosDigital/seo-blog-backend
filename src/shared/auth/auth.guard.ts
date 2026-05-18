import {
  CanActivate,
  ExecutionContext,
  Injectable,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { timingSafeEqual } from 'crypto';
import { Request } from 'express';
import { IS_PUBLIC_KEY } from '../decorators/IsPublic.decorator';
import { REQUIRES_SECURITY_TOKEN_KEY } from '../decorators/RequiresSecurityToken.decorator';
import { EnvService } from '../env/env.service';

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    private reflector: Reflector,
    private envService: EnvService,
    private jwtService: JwtService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const requiresSecurityToken = this.reflector.getAllAndOverride<boolean>(
      REQUIRES_SECURITY_TOKEN_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (requiresSecurityToken) {
      const request = context.switchToHttp().getRequest<Request>();
      this.assertValidSecurityToken(request);
      return true;
    }

    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const request = context.switchToHttp().getRequest();
    const token = this.extractTokenFromHeader(request);
    if (!token) throw new UnauthorizedException('Authorization token not found');

    try {
      const payload = await this.jwtService.verifyAsync(token);
      request.userId = payload.sub;
      request.adminAuth = {
        sub: payload.sub,
        email: payload.email,
        name: payload.name,
        role: payload.role,
      };
      return true;
    } catch {
      throw new UnauthorizedException('Token is not valid');
    }
  }

  private assertValidSecurityToken(request: Request): void {
    const expected = (this.envService.get('SECURITY_TOKEN') ?? '').trim();
    if (!expected) throw new ServiceUnavailableException('SECURITY_TOKEN not configured');
    const provided = this.extractSecurityTokenFromApiKeyHeader(request);
    if (!this.constantTimeEquals(provided, expected)) {
      throw new UnauthorizedException('Invalid or missing security token');
    }
  }

  private extractSecurityTokenFromApiKeyHeader(request: Request): string | undefined {
    const v =
      request.get('apiKey') ??
      request.get('apikey') ??
      (request.headers as Record<string, string | string[] | undefined>)['apikey'];
    if (v === undefined || v === null) return undefined;
    const s = Array.isArray(v) ? v[0] : v;
    return String(s).trim() || undefined;
  }

  private constantTimeEquals(a: string | undefined, b: string): boolean {
    if (!a) return false;
    const bufA = Buffer.from(a, 'utf8');
    const bufB = Buffer.from(b, 'utf8');
    if (bufA.length !== bufB.length) return false;
    return timingSafeEqual(bufA, bufB);
  }

  private extractTokenFromHeader(request: Request): string | undefined {
    const [type, token] = request.headers.authorization?.split(' ') ?? [];
    return type === 'Bearer' ? token : undefined;
  }
}
