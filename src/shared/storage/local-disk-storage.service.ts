import { Injectable } from '@nestjs/common';
import * as fs from 'fs/promises';
import * as path from 'path';
import { randomUUID } from 'crypto';
import { EnvService } from '../env/env.service';
import { IStorage, UploadParams, UploadResult } from './storage.interface';

/**
 * Fallback de dev — escreve em disco e serve via /uploads.
 * Em produção, sempre usar R2 (STORAGE_DRIVER=r2).
 */
@Injectable()
export class LocalDiskStorageService implements IStorage {
  constructor(private envService: EnvService) {}

  async upload({ fileName, fileType, body }: UploadParams): Promise<UploadResult> {
    const dir = path.resolve(this.envService.get('LOCAL_STORAGE_PATH'));
    await fs.mkdir(dir, { recursive: true });
    const safe = (fileName || 'file').replace(/[^\w.\-]/g, '_');
    const key = `${randomUUID()}-${safe}`;
    await fs.writeFile(path.join(dir, key), body);
    const url = `${this.envService.get('LOCAL_STORAGE_BASE_URL').replace(/\/$/, '')}/${key}`;
    return { url, key };
  }

  async delete(key: string): Promise<void> {
    const dir = path.resolve(this.envService.get('LOCAL_STORAGE_PATH'));
    try {
      await fs.unlink(path.join(dir, key));
    } catch {
      /* ignore */
    }
  }
}
