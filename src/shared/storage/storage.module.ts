import { Global, Module } from '@nestjs/common';
import { EnvService } from '../env/env.service';
import { LocalDiskStorageService } from './local-disk-storage.service';
import { R2StorageService } from './r2-storage.service';
import { IStorage, STORAGE_TOKEN } from './storage.interface';

@Global()
@Module({
  providers: [
    LocalDiskStorageService,
    {
      provide: R2StorageService,
      useFactory: (env: EnvService) => {
        if (env.get('STORAGE_DRIVER') === 'r2') return new R2StorageService(env);
        return null;
      },
      inject: [EnvService],
    },
    {
      provide: STORAGE_TOKEN,
      useFactory: (env: EnvService, local: LocalDiskStorageService): IStorage => {
        if (env.get('STORAGE_DRIVER') === 'r2') return new R2StorageService(env);
        return local;
      },
      inject: [EnvService, LocalDiskStorageService],
    },
  ],
  exports: [STORAGE_TOKEN],
})
export class StorageModule {}
