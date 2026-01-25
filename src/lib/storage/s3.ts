// ===========================================
// S3-Compatible Storage Backend (AWS S3, Cloudflare R2, MinIO)
// ===========================================

import {
  S3Client,
  PutObjectCommand,
  HeadObjectCommand,
  DeleteObjectCommand,
  GetObjectCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { BaseMediaStorage } from './base';
import { MediaStorageResult } from '@/types';

export class S3Storage extends BaseMediaStorage {
  private client: S3Client;
  private bucket: string;
  private publicBaseUrl?: string;

  constructor() {
    super();
    const endpoint = process.env.S3_ENDPOINT;
    const region = process.env.S3_REGION || 'auto';
    const accessKeyId = process.env.S3_ACCESS_KEY_ID!;
    const secretAccessKey = process.env.S3_SECRET_ACCESS_KEY!;

    this.bucket = process.env.S3_BUCKET!;
    this.publicBaseUrl = process.env.S3_PUBLIC_BASE_URL;

    this.client = new S3Client({
      endpoint,
      region,
      credentials: {
        accessKeyId,
        secretAccessKey,
      },
      // Required for some S3-compatible services like R2
      forcePathStyle: true,
    });
  }

  async putObject(
    path: string,
    contentType: string,
    data: Buffer | Uint8Array | ReadableStream
  ): Promise<MediaStorageResult> {
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

    const command = new PutObjectCommand({
      Bucket: this.bucket,
      Key: path,
      Body: uploadData,
      ContentType: contentType,
    });

    await this.client.send(command);

    // If public base URL is configured, use it; otherwise generate signed URL
    let url: string;
    if (this.publicBaseUrl) {
      url = this.getPublicUrl(path);
    } else {
      url = await this.getSignedUrl(path);
    }

    return { path, url };
  }

  getPublicUrl(path: string): string {
    if (this.publicBaseUrl) {
      // Use custom public domain
      return `${this.publicBaseUrl}/${path}`;
    }
    // Fallback: construct URL from endpoint (may not work for private buckets)
    const endpoint = process.env.S3_ENDPOINT || '';
    return `${endpoint}/${this.bucket}/${path}`;
  }

  async getSignedUrl(path: string, expiresInSeconds = 3600): Promise<string> {
    const command = new GetObjectCommand({
      Bucket: this.bucket,
      Key: path,
    });

    return getSignedUrl(this.client, command, { expiresIn: expiresInSeconds });
  }

  async exists(path: string): Promise<boolean> {
    try {
      const command = new HeadObjectCommand({
        Bucket: this.bucket,
        Key: path,
      });
      await this.client.send(command);
      return true;
    } catch (error) {
      // NotFound error means file doesn't exist
      if ((error as Error).name === 'NotFound') {
        return false;
      }
      throw error;
    }
  }

  async deleteObject(path: string): Promise<void> {
    const command = new DeleteObjectCommand({
      Bucket: this.bucket,
      Key: path,
    });
    await this.client.send(command);
  }
}
