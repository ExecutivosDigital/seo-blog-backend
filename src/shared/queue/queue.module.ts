import { BullModule } from '@nestjs/bullmq';
import { Global, Module } from '@nestjs/common';
import { EnvService } from '../env/env.service';

@Global()
@Module({
  imports: [
    BullModule.forRootAsync({
      inject: [EnvService],
      useFactory: (env: EnvService) => ({
        connection: {
          host: env.get('REDIS_HOST'),
          port: env.get('REDIS_PORT'),
        },
      }),
    }),
  ],
  exports: [BullModule],
})
export class QueueModule {}
