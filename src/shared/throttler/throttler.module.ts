import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule as NestThrottler } from '@nestjs/throttler';

/**
 * Rate-limit global. Limites pequenos no /auth + /ai pra evitar abuso/burst.
 *   short  → 10 req / 10s
 *   medium → 60 req / 1min
 *   long   → 300 req / 5min
 * Rotas que precisam de quota mais alta usam @SkipThrottle() ou @Throttle({...}).
 */
@Module({
  imports: [
    NestThrottler.forRoot([
      { name: 'short', ttl: 10_000, limit: 10 },
      { name: 'medium', ttl: 60_000, limit: 60 },
      { name: 'long', ttl: 300_000, limit: 300 },
    ]),
  ],
  providers: [{ provide: APP_GUARD, useClass: ThrottlerGuard }],
})
export class ThrottlerModule {}
