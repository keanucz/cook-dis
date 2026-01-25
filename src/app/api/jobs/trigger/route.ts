import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase/server';

/**
 * This endpoint allows authenticated users to trigger the job worker.
 * It's called from the cook page to ensure images get generated.
 * The actual worker is called server-side with the CRON_SECRET.
 */
export async function POST(request: NextRequest) {
  try {
    // Verify user is authenticated
    const supabase = await createSupabaseServerClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const cronSecret = process.env.CRON_SECRET;
    if (!cronSecret) {
      console.warn('[TRIGGER] CRON_SECRET not configured');
      return NextResponse.json({ error: 'Worker not configured' }, { status: 500 });
    }

    // Get the base URL for internal API calls
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
    
    console.log('[TRIGGER] User triggered worker, calling:', `${baseUrl}/api/jobs/worker`);

    // Call the worker endpoint with the CRON_SECRET
    const workerResponse = await fetch(`${baseUrl}/api/jobs/worker`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${cronSecret}`,
        'Content-Type': 'application/json',
      },
    });

    if (!workerResponse.ok) {
      const errorText = await workerResponse.text();
      console.error('[TRIGGER] Worker call failed:', workerResponse.status, errorText);
      return NextResponse.json({ error: 'Worker failed' }, { status: 500 });
    }

    const result = await workerResponse.json();
    console.log('[TRIGGER] Worker completed:', result);

    return NextResponse.json(result);
  } catch (error) {
    console.error('[TRIGGER] Error:', error);
    return NextResponse.json(
      { error: (error as Error).message || 'Failed to trigger worker' },
      { status: 500 }
    );
  }
}
