import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  constructor(configService: ConfigService) {
    const dbUrl = configService.get<string>('DATABASE_URL');
    if (dbUrl) {
      const masked = dbUrl.replace(/:[^:@]+@/, ':****@');
      console.log('[PrismaService] connecting:', masked);
    }
    super({
      log: ['warn', 'error'],
      datasources: { db: { url: dbUrl } },
    });
  }

  async onModuleInit() {
    await this.$connect();
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }
}
