import { ExecutionContext, createParamDecorator } from '@nestjs/common';
import {
  RequestWithTrackingSite,
  TrackingSiteContext,
} from '../guards/site-key.guard';

/**
 * Injeta o site resolvido pelo `SiteKeyGuard`. Só use em rotas protegidas
 * por esse guard — caso contrário o valor é undefined.
 */
export const CurrentTrackingSite = createParamDecorator<undefined>(
  (_: undefined, ctx: ExecutionContext): TrackingSiteContext => {
    const req = ctx.switchToHttp().getRequest<RequestWithTrackingSite>();
    if (!req.trackingSite) {
      throw new Error('CurrentTrackingSite usado sem SiteKeyGuard na rota');
    }
    return req.trackingSite;
  },
);
