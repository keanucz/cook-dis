// ===========================================
// Media Storage Interface
// ===========================================

import { MediaStorageProvider, MediaStorageResult } from '@/types';

export abstract class BaseMediaStorage implements MediaStorageProvider {
  abstract putObject(
    path: string,
    contentType: string,
    data: Buffer | Uint8Array | ReadableStream
  ): Promise<MediaStorageResult>;

  abstract getPublicUrl(path: string): string;

  abstract getSignedUrl(path: string, expiresInSeconds?: number): Promise<string>;

  abstract exists(path: string): Promise<boolean>;

  abstract deleteObject(path: string): Promise<void>;

  // Helper to generate deterministic paths
  static generateMediaPath(
    userId: string,
    recipeId: string,
    stepIndex: number,
    type: 'image' | 'audio'
  ): string {
    const extension = type === 'image' ? 'webp' : 'mp3';
    return `user/${userId}/recipe/${recipeId}/step/${stepIndex}/${type}.${extension}`;
  }
}
