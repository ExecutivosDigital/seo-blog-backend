import { BadRequestException, ExecutionContext, createParamDecorator } from '@nestjs/common';

/**
 * Extrai o id do site (tenant) do header `X-Site-Id`. Erro 400 se ausente.
 * Para uso opcional, prefira `@CurrentSiteIdOptional`.
 */
export const CurrentSiteId = createParamDecorator<undefined>(
  (_: undefined, ctx: ExecutionContext): string => {
    const req = ctx.switchToHttp().getRequest();
    const siteId = req.headers['x-site-id'];
    if (!siteId || typeof siteId !== 'string') {
      throw new BadRequestException('Missing X-Site-Id header');
    }
    return siteId;
  },
);

export const CurrentSiteIdOptional = createParamDecorator<undefined>(
  (_: undefined, ctx: ExecutionContext): string | undefined => {
    const req = ctx.switchToHttp().getRequest();
    const siteId = req.headers['x-site-id'];
    return typeof siteId === 'string' ? siteId : undefined;
  },
);
