// ===========================================
// Media Storage Factory
// ===========================================

import { MediaStorageProvider } from '@/types';
import { SupabaseStorage } from './supabase';
import { LocalStorage } from './local';
import { S3Storage } from './s3';
import { BaseMediaStorage } from './base';

export type StorageBackend = 'supabase' | 'local' | 's3';

let storageInstance: MediaStorageProvider | null = null;

export function getStorageBackend(): StorageBackend {
  const backend = process.env.MEDIA_STORAGE_BACKEND as StorageBackend;
  if (!backend || !['supabase', 'local', 's3'].includes(backend)) {
    console.warn(
      `Invalid MEDIA_STORAGE_BACKEND: ${backend}. Defaulting to 'local'.`
    );
    return 'local';
  }
  return backend;
}

export function getMediaStorage(): MediaStorageProvider {
  if (storageInstance) {
    return storageInstance;
  }

  const backend = getStorageBackend();

  switch (backend) {
    case 'supabase':
      storageInstance = new SupabaseStorage();
      break;
    case 's3':
      storageInstance = new S3Storage();
      break;
    case 'local':
    default:
      storageInstance = new LocalStorage();
      break;
  }

  return storageInstance;
}

// Re-export for convenience
export { BaseMediaStorage } from './base';
export { SupabaseStorage } from './supabase';
export { LocalStorage } from './local';
export { S3Storage } from './s3';
