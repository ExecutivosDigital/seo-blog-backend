export interface UploadParams {
  fileName: string;
  fileType: string;
  body: Buffer;
}

export interface UploadResult {
  url: string;
  key: string;
}

export interface IStorage {
  upload(params: UploadParams): Promise<UploadResult>;
  delete(key: string): Promise<void>;
}

export const STORAGE_TOKEN = Symbol('IStorage');
