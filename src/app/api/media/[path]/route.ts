import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { getStorageBackend } from '@/lib/storage';
import { LocalStorage } from '@/lib/storage/local';
import fs from 'fs/promises';
import path from 'path';

// Get the correct MIME type
function getMimeType(filePath: string): string {
  const ext = path.extname(filePath).toLowerCase();
  const mimeTypes: Record<string, string> = {
    '.webp': 'image/webp',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.mp3': 'audio/mpeg',
    '.wav': 'audio/wav',
    '.ogg': 'audio/ogg',
  };
  return mimeTypes[ext] || 'application/octet-stream';
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ path: string }> }
) {
  try {
    // Only serve files when using local storage
    if (getStorageBackend() !== 'local') {
      return NextResponse.json(
        { error: 'This endpoint is only available for local storage' },
        { status: 404 }
      );
    }

    const { path: encodedPath } = await params;
    const filePath = decodeURIComponent(encodedPath);
    
    // Security: Ensure the path is within allowed directories
    if (filePath.includes('..') || filePath.startsWith('/')) {
      return NextResponse.json({ error: 'Invalid path' }, { status: 400 });
    }

    // Check for signed URL parameters
    const searchParams = request.nextUrl.searchParams;
    const expires = searchParams.get('expires');
    const sig = searchParams.get('sig');

    // If signed URL params are provided, verify them
    if (expires && sig) {
      if (!LocalStorage.verifySignature(filePath, expires, sig)) {
        return NextResponse.json({ error: 'Invalid or expired signature' }, { status: 403 });
      }
    } else {
      // Otherwise, verify user is authenticated and owns the resource
      const supabase = await createSupabaseServerClient();
      const { data: { user } } = await supabase.auth.getUser();

      if (!user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      }

      // Verify the path belongs to the user
      // Path format: user/{userId}/recipe/{recipeId}/step/{stepIndex}/image.webp
      const pathParts = filePath.split('/');
      if (pathParts[0] !== 'user' || pathParts[1] !== user.id) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
      }
    }

    // Read the file
    const basePath = process.env.LOCAL_STORAGE_PATH || './data/media';
    const fullPath = path.join(process.cwd(), basePath, filePath);

    try {
      const fileBuffer = await fs.readFile(fullPath);
      const mimeType = getMimeType(filePath);

      return new NextResponse(fileBuffer, {
        headers: {
          'Content-Type': mimeType,
          'Cache-Control': 'public, max-age=31536000, immutable',
        },
      });
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        return NextResponse.json({ error: 'File not found' }, { status: 404 });
      }
      throw error;
    }
  } catch (error) {
    console.error('Media serve error:', error);
    return NextResponse.json(
      { error: (error as Error).message || 'Failed to serve media' },
      { status: 500 }
    );
  }
}
