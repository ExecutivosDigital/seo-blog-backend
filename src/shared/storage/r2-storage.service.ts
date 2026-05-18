import { DeleteObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { Injectable } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { EnvService } from '../env/env.service';
import { IStorage, UploadParams, UploadResult } from './storage.interface';

@Injectable()
export class R2StorageService implements IStorage {
  private client: S3Client;

  constructor(private envService: EnvService) {
    const accountId = envService.get('CLOUDFLARE_ACCOUNT_ID');
    const accessKeyId = envService.get('CLOUDFLARE_AWS_ACCESS_KEY_ID');
    const secretAccessKey = envService.get('CLOUDFLARE_AWS_SECRET_ACCESS_KEY_ID');

    if (!accountId || !accessKeyId || !secretAccessKey) {
      throw new Error(
        '[R2StorageService] missing CLOUDFLARE_* env vars. Set STORAGE_DRIVER=local or fill credentials.',
      );
    }

    this.client = new S3Client({
      endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
      region: 'auto',
      credentials: { accessKeyId, secretAccessKey },
    });
  }

  async upload({ fileName, fileType, body }: UploadParams): Promise<UploadResult> {
    const bucket = this.envService.get('AWS_BUCKET_NAME');
    if (!bucket) throw new Error('[R2StorageService] AWS_BUCKET_NAME not set');

    const safe = (fileName || 'file').replace(/[^\w.\-]/g, '_');
    const key = `${randomUUID()}-${safe}`;

    await this.client.send(
      new PutObjectCommand({
        Bucket: bucket,
        Key: key,
        ContentType: fileType,
        Body: body,
      }),
    );

    const publicBase = this.envService.get('CLOUDFLARE_PUBLIC_URL');
    const url = publicBase
      ? `${publicBase.replace(/\/$/, '')}/${key}`
      : `https://${this.envService.get('CLOUDFLARE_ACCOUNT_ID')}.r2.cloudflarestorage.com/${bucket}/${key}`;

    return { url, key };
  }

  async delete(key: string): Promise<void> {
    const bucket = this.envService.get('AWS_BUCKET_NAME');
    if (!bucket) throw new Error('[R2StorageService] AWS_BUCKET_NAME not set');
    await this.client.send(new DeleteObjectCommand({ Bucket: bucket, Key: key }));
  }
}
