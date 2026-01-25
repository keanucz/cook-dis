import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseAdminClient } from '@/lib/supabase/server';
import { getRunwareService } from '@/lib/services/runware';
import { getElevenLabsService } from '@/lib/services/elevenlabs';
import { getMediaStorage, BaseMediaStorage } from '@/lib/storage';
import { RunwareModelArchitecture } from '@/types';

const MAX_CONCURRENT_JOBS = 3;
const JOB_TIMEOUT_MS = 120000; // 2 minutes

interface ImageJobPayload {
  stepId: string;
  recipeId: string;
  userId: string;
  stepIndex: number;
  instruction: string;
  recipeTitle: string;
  modelArchitecture: RunwareModelArchitecture;
  modelAIR: string;
}

interface AudioJobPayload {
  stepId: string;
  recipeId: string;
  userId: string;
  stepIndex: number;
  instruction: string;
}

export async function POST(request: NextRequest) {
  try {
    // Verify cron secret
    const authHeader = request.headers.get('authorization');
    const cronSecret = process.env.CRON_SECRET;

    if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const adminClient = createSupabaseAdminClient();
    const storage = getMediaStorage();
    const processedJobs: string[] = [];
    const failedJobs: string[] = [];

    // Claim jobs to process (image generation only - audio is on-demand)
    for (let i = 0; i < MAX_CONCURRENT_JOBS; i++) {
      // Claim next pending job
      const { data: job, error } = await adminClient.rpc('claim_next_job', {
        job_types: ['generate_step_image'],
      });

      if (error || !job?.id) {
        break; // No more jobs
      }

      try {
        // Process the job with timeout
        await Promise.race([
          processJob(job, adminClient, storage),
          new Promise((_, reject) =>
            setTimeout(() => reject(new Error('Job timeout')), JOB_TIMEOUT_MS)
          ),
        ]);

        // Mark job complete
        await adminClient.rpc('complete_job', { job_id: job.id });
        processedJobs.push(job.id);
      } catch (error) {
        const errorMessage = (error as Error).message || 'Unknown error';
        await adminClient.rpc('fail_job', {
          job_id: job.id,
          error_message: errorMessage,
        });
        failedJobs.push(job.id);
        console.error(`Job ${job.id} failed:`, errorMessage);
      }
    }

    return NextResponse.json({
      success: true,
      processed: processedJobs.length,
      failed: failedJobs.length,
      processedJobs,
      failedJobs,
    });
  } catch (error) {
    console.error('Worker error:', error);
    return NextResponse.json(
      { error: (error as Error).message || 'Worker failed' },
      { status: 500 }
    );
  }
}

async function processJob(
  job: { id: string; type: string; payload: Record<string, unknown> },
  adminClient: ReturnType<typeof createSupabaseAdminClient>,
  storage: ReturnType<typeof getMediaStorage>
) {
  switch (job.type) {
    case 'generate_step_image':
      await processImageJob(job.payload as unknown as ImageJobPayload, adminClient, storage);
      break;
    case 'generate_step_audio':
      await processAudioJob(job.payload as unknown as AudioJobPayload, adminClient, storage);
      break;
    default:
      throw new Error(`Unknown job type: ${job.type}`);
  }
}

async function processImageJob(
  payload: ImageJobPayload,
  adminClient: ReturnType<typeof createSupabaseAdminClient>,
  storage: ReturnType<typeof getMediaStorage>
) {
  const { stepId, recipeId, userId, stepIndex, instruction, recipeTitle, modelArchitecture, modelAIR } = payload;

  // Generate deterministic path
  const imagePath = BaseMediaStorage.generateMediaPath(userId, recipeId, stepIndex, 'image');

  // Check if image already exists (idempotency)
  if (await storage.exists(imagePath)) {
    // Update status to completed
    await adminClient
      .from('step_media')
      .update({ image_status: 'completed', image_path: imagePath })
      .eq('step_id', stepId);
    return;
  }

  // Update status to processing
  await adminClient
    .from('step_media')
    .update({ image_status: 'processing' })
    .eq('step_id', stepId);

  // Generate the image
  const runware = getRunwareService();
  const { imageBuffer, prompt } = await runware.generateStepImage(
    instruction,
    recipeTitle,
    stepIndex,
    modelArchitecture,
    modelAIR
  );

  // Upload to storage
  await storage.putObject(imagePath, 'image/webp', imageBuffer);

  // Update step_media record
  await adminClient
    .from('step_media')
    .update({
      image_path: imagePath,
      image_status: 'completed',
      generation_prompt: prompt,
    })
    .eq('step_id', stepId);
}

async function processAudioJob(
  payload: AudioJobPayload,
  adminClient: ReturnType<typeof createSupabaseAdminClient>,
  storage: ReturnType<typeof getMediaStorage>
) {
  const { stepId, recipeId, userId, stepIndex, instruction } = payload;

  // Generate deterministic path
  const audioPath = BaseMediaStorage.generateMediaPath(userId, recipeId, stepIndex, 'audio');

  // Check if audio already exists (idempotency)
  if (await storage.exists(audioPath)) {
    // Update status to completed
    await adminClient
      .from('step_media')
      .update({ audio_status: 'completed', audio_path: audioPath })
      .eq('step_id', stepId);
    return;
  }

  // Update status to processing
  await adminClient
    .from('step_media')
    .update({ audio_status: 'processing' })
    .eq('step_id', stepId);

  // Generate the audio
  const elevenlabs = getElevenLabsService();
  const audioBuffer = await elevenlabs.generateStepNarration(instruction, stepIndex);

  // Upload to storage
  await storage.putObject(audioPath, 'audio/mpeg', audioBuffer);

  // Update step_media record
  await adminClient
    .from('step_media')
    .update({
      audio_path: audioPath,
      audio_status: 'completed',
    })
    .eq('step_id', stepId);
}

// Also support GET for easier cron setup
export async function GET(request: NextRequest) {
  return POST(request);
}
