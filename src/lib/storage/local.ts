// ===========================================
// Local Filesystem Storage Backend
// ===========================================

import fs from 'fs/promises';
import path from 'path';
import { BaseMediaStorage } from './base';
import { MediaStorageResult } from '@/types';
import crypto from 'crypto';

export class LocalStorage extends BaseMediaStorage {
  private basePath: string;
  private baseUrl: string;

  constructor() {
    super();
    // Default to ./data/media, can be overridden via env
    this.basePath = process.env.LOCAL_STORAGE_PATH || './data/media';
    this.baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
  }

  private getFullPath(filePath: string): string {
    return path.join(this.basePath, filePath);
  }

  async putObject(
    filePath: string,
    contentType: string,
    data: Buffer | Uint8Array | ReadableStream
  ): Promise<MediaStorageResult> {
    const fullPath = this.getFullPath(filePath);
    const dir = path.dirname(fullPath);

    // Ensure directory exists
    await fs.mkdir(dir, { recursive: true });

    // Convert ReadableStream to Buffer if needed
    let writeData: Buffer | Uint8Array;
    if (data instanceof ReadableStream) {
      const chunks: Uint8Array[] = [];
      const reader = data.getReader();
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        if (value) chunks.push(value);
      }
      writeData = Buffer.concat(chunks);
    } else {
      writeData = data;
    }

    await fs.writeFile(fullPath, writeData);

    // Return the secure route URL
    const url = this.getPublicUrl(filePath);

    return { path: filePath, url };
  }

  getPublicUrl(filePath: string): string {
    // Use the secure API route for serving files
    const encodedPath = encodeURIComponent(filePath);
    return `${this.baseUrl}/api/media/${encodedPath}`;
  }

  async getSignedUrl(filePath: string, expiresInSeconds = 3600): Promise<string> {
    // For local storage, we generate a simple signed token
    const expires = Date.now() + expiresInSeconds * 1000;
    const secret = process.env.CRON_SECRET || 'dev-secret';
    const signature = crypto
      .createHmac('sha256', secret)
      .update(`${filePath}:${expires}`)
      .digest('hex');

    const encodedPath = encodeURIComponent(filePath);
    return `${this.baseUrl}/api/media/${encodedPath}?expires=${expires}&sig=${signature}`;
  }

  async exists(filePath: string): Promise<boolean> {
    const fullPath = this.getFullPath(filePath);
    try {
      await fs.access(fullPath);
      return true;
    } catch {
      return false;
    }
  }

  async deleteObject(filePath: string): Promise<void> {
    const fullPath = this.getFullPath(filePath);
    try {
      await fs.unlink(fullPath);
    } catch (error) {
      // Ignore if file doesn't exist
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
        throw error;
      }
    }
  }

  // Verify a signed URL token
  static verifySignature(
    filePath: string,
    expires: string,
    signature: string
  ): boolean {
    const expiresNum = parseInt(expires, 10);
    if (isNaN(expiresNum) || Date.now() > expiresNum) {
      return false;
    }

    const secret = process.env.CRON_SECRET || 'dev-secret';
    const expectedSig = crypto
      .createHmac('sha256', secret)
      .update(`${filePath}:${expires}`)
      .digest('hex');

    return crypto.timingSafeEqual(
      Buffer.from(signature),
      Buffer.from(expectedSig)
    );
  }
}
