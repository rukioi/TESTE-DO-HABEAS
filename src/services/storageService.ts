export interface StorageConfig {
  driver: 'local' | 'supabase';
  supabase?: {
    url: string;
    serviceKey: string;
    productBucket: string;
    categoryBucket: string;
    storeBucket: string;
  };
  local?: {
    uploadPath: string;
  };
}

export class StorageService {
  private readonly config: StorageConfig;
  private readonly supabase: any = null;
  private readonly maxFileSize: number = 10 * 1024 * 1024;
  private readonly allowedMimeTypes = [
    'image/jpeg',
    'image/jpg',
    'image/png',
    'image/gif',
    'image/webp'
  ];

}
