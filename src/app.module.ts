import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { DatabaseModule } from './shared/database/database.module';
import { EnvModule } from './shared/env/env.module';
import { envSchema } from './shared/env/env';
import { StorageModule } from './shared/storage/storage.module';
import { QueueModule } from './shared/queue/queue.module';
import { AuthModule } from './shared/auth/auth.module';
import { HealthModule } from './modules/health/health.module';
import { SitesModule } from './modules/sites/sites.module';
import { ContentTypesModule } from './modules/content-types/content-types.module';
import { AdminUsersModule } from './modules/admin-users/admin-users.module';
import { IdeasModule } from './modules/ideas/ideas.module';
import { AiModule } from './shared/ai/ai.module';
import { PromptsModule } from './modules/prompts/prompts.module';
import { MetricsModule } from './modules/metrics/metrics.module';
import { ContentsModule } from './modules/contents/contents.module';
import { MediaModule } from './modules/media/media.module';
import { ScheduleModule } from './modules/schedule/schedule.module';
import { PublishModule } from './modules/publish/publish.module';
import { PublicModule } from './modules/public/public.module';
import { ThrottlerModule } from './shared/throttler/throttler.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      validate: (env) => envSchema.parse(env),
    }),
    EnvModule,
    DatabaseModule,
    ThrottlerModule,
    AuthModule,
    StorageModule,
    QueueModule,
    HealthModule,
    SitesModule,
    ContentTypesModule,
    AdminUsersModule,
    IdeasModule,
    AiModule,
    PromptsModule,
    MetricsModule,
    ContentsModule,
    MediaModule,
    ScheduleModule,
    PublishModule,
    PublicModule,
  ],
})
export class AppModule {}
