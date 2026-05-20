import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Request } from 'express';
import { PrismaService } from '@/shared/database/prisma/prisma.service';
import { isUuid } from '../tracking.util';

/** Site resolvido pela publicKey, anexado à request. */
export interface TrackingSiteContext {
  id: string;
  slug: string;
}

export type RequestWithTrackingSite = Request & {
  trackingSite?: TrackingSiteContext;
};

/**
 * Valida o header `X-Site-Key` contra `Site.publicKey`.
 * - sem key / key inválida        → 401
 * - site inativo ou sem tracking  → 403
 * Em sucesso, anexa `req.trackingSite`. Ver docs/tracking/ARQUITETURA-TRACKING.md §3.1.
 */
@Injectable()
export class SiteKeyGuard implements CanActivate {
  constructor(private prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<RequestWithTrackingSite>();

    const key = (req.get('x-site-key') ?? '').trim();
    if (!key) throw new UnauthorizedException('Missing X-Site-Key header');
    // publicKey é UUID; validar formato evita erro de query do Prisma com input inválido.
    if (!isUuid(key)) throw new UnauthorizedException('Invalid X-Site-Key');

    const site = await this.prisma.site.findUnique({
      where: { publicKey: key },
      select: { id: true, slug: true, active: true, trackingEnabled: true },
    });

    if (!site) throw new UnauthorizedException('Invalid X-Site-Key');
    if (!site.active) throw new ForbiddenException('Site is inactive');
    if (!site.trackingEnabled) {
      throw new ForbiddenException('Tracking is disabled for this site');
    }

    req.trackingSite = { id: site.id, slug: site.slug };
    return true;
  }
}
