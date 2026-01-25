// ===========================================
// Supabase Storage Backend
// ===========================================

import { createClient } from '@supabase/supabase-js';
import { BaseMediaStorage } from './base';
import { MediaStorageResult } from '@/types';

export class SupabaseStorage extends BaseMediaStorage {
  private client;
  private imageBucket = 'recipe-step-images';
  private audioBucket = 'recipe-step-audio';

  constructor() {
    super();
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
    
    this.client = createClient(supabaseUrl, supabaseServiceKey);
  }

  private getBucket(path: string): string {
    return path.includes('/audio.') ? this.audioBucket : this.imageBucket;
  }

  async putObject(
    path: string,
    contentType: string,
    data: Buffer | Uint8Array | ReadableStream
  ): Promise<MediaStorageResult> {
    const bucket = this.getBucket(path);
    
    // Convert ReadableStream to Buffer if needed
    let uploadData: Buffer | Uint8Array;
    if (data instanceof ReadableStream) {
      const chunks: Uint8Array[] = [];
      const reader = data.getReader();
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        if (value) chunks.push(value);
      }
      uploadData = Buffer.concat(chunks);
    } else {
      uploadData = data;
    }

    const { error } = await this.client.storage
      .from(bucket)
      .upload(path, uploadData, {
        contentType,
        upsert: true,
      });

    if (error) {
      throw new Error(`Supabase storage upload failed: ${error.message}`);
    }

    // Get signed URL for private buckets
    const url = await this.getSignedUrl(path);

    return { path, url };
  }

  getPublicUrl(path: string): string {
    const bucket = this.getBucket(path);
    const { data } = this.client.storage.from(bucket).getPublicUrl(path);
    return data.publicUrl;
  }

  async getSignedUrl(path: string, expiresInSeconds = 3600): Promise<string> {
    const bucket = this.getBucket(path);
    const { data, error } = await this.client.storage
      .from(bucket)
      .createSignedUrl(path, expiresInSeconds);

    if (error) {
      throw new Error(`Failed to create signed URL: ${error.message}`);
    }

    return data.signedUrl;
  }

  async exists(path: string): Promise<boolean> {
    const bucket = this.getBucket(path);
    
    // Extract directory and filename from path
    const parts = path.split('/');
    const fileName = parts.pop()!;
    const dirPath = parts.join('/');

    const { data, error } = await this.client.storage
      .from(bucket)
      .list(dirPath, { search: fileName });

    if (error) {
      return false;
    }

    return data.some(file => file.name === fileName);
  }

  async deleteObject(path: string): Promise<void> {
    const bucket = this.getBucket(path);
    const { error } = await this.client.storage.from(bucket).remove([path]);

    if (error) {
      throw new Error(`Failed to delete object: ${error.message}`);
    }
  }
}
