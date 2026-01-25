import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseAdminClient } from '@/lib/supabase/server';
import { getRunwareService } from '@/lib/services/runware';
import { getElevenLabsService } from '@/lib/services/elevenlabs';
import { getMediaStorage, BaseMediaStorage } from '@/lib/storage';
import { RunwareModelArchitecture } from '@/types';

const MAX_CONCURRENT_JOBS = 3;
const JOB_TIMEOUT_MS = 120000; // 2 minutes

// Verbose logging helper
function log(message: string, data?: unknown) {
  const timestamp = new Date().toISOString();
  console.log(`[WORKER ${timestamp}] ${message}`);
  if (data !== undefined) {
    console.log(`[WORKER ${timestamp}] Data:`, JSON.stringify(data, null, 2));
  }
}

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
  log('========== WORKER INVOKED ==========');
  try {
    // Verify cron secret
    const authHeader = request.headers.get('authorization');
    const cronSecret = process.env.CRON_SECRET;

    if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
      log('Unauthorized request - cron secret mismatch');
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    log('Authorization verified. Creating admin client...');
    const adminClient = createSupabaseAdminClient();
    const storage = getMediaStorage();
    log(`Storage backend: ${storage.constructor.name}`);
    const processedJobs: string[] = [];
    const failedJobs: string[] = [];

    // Claim jobs to process (image generation only - audio is on-demand)
    log(`Starting job processing loop (max ${MAX_CONCURRENT_JOBS} jobs)...`);
    for (let i = 0; i < MAX_CONCURRENT_JOBS; i++) {
      log(`Attempting to claim job ${i + 1}/${MAX_CONCURRENT_JOBS}...`);
      // Claim next pending job
      const { data: job, error } = await adminClient.rpc('claim_next_job', {
        job_types: ['generate_step_image'],
      });

      if (error) {
        log(`Error claiming job: ${error.message}`);
        break;
      }
      
      if (!job?.id) {
        log('No more jobs to process');
        break; // No more jobs
      }

      log(`Claimed job:`, { id: job.id, type: job.type, payload: job.payload });

      try {
        // Process the job with timeout
        log(`Processing job ${job.id} with ${JOB_TIMEOUT_MS}ms timeout...`);
        const startTime = Date.now();
        await Promise.race([
          processJob(job, adminClient, storage),
          new Promise((_, reject) =>
            setTimeout(() => reject(new Error('Job timeout')), JOB_TIMEOUT_MS)
          ),
        ]);
        const duration = Date.now() - startTime;
        log(`Job ${job.id} completed in ${duration}ms`);

        // Mark job complete
        log(`Marking job ${job.id} as complete...`);
        await adminClient.rpc('complete_job', { job_id: job.id });
        processedJobs.push(job.id);
        log(`Job ${job.id} marked complete successfully`);
      } catch (error) {
        const errorMessage = (error as Error).message || 'Unknown error';
        log(`Job ${job.id} FAILED: ${errorMessage}`);
        await adminClient.rpc('fail_job', {
          job_id: job.id,
          error_message: errorMessage,
        });
        failedJobs.push(job.id);
        console.error(`Job ${job.id} failed:`, errorMessage);
      }
    }

    log(`========== WORKER COMPLETE ==========`);
    log(`Processed: ${processedJobs.length}, Failed: ${failedJobs.length}`);

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

  log(`========== PROCESSING IMAGE JOB ==========`);
  log(`Step ID: ${stepId}`);
  log(`Recipe ID: ${recipeId}`);
  log(`User ID: ${userId}`);
  log(`Step Index: ${stepIndex}`);
  log(`Instruction: ${instruction.substring(0, 100)}...`);
  log(`Recipe Title: ${recipeTitle}`);
  log(`Model: ${modelArchitecture} / ${modelAIR}`);

  // Generate deterministic path
  const imagePath = BaseMediaStorage.generateMediaPath(userId, recipeId, stepIndex, 'image');
  log(`Generated image path: ${imagePath}`);

  // Check if image already exists (idempotency)
  log(`Checking if image already exists...`);
  if (await storage.exists(imagePath)) {
    log(`Image already exists! Updating status to completed.`);
    // Update status to completed
    await adminClient
      .from('step_media')
      .update({ image_status: 'completed', image_path: imagePath })
      .eq('step_id', stepId);
    return;
  }

  log(`Image does not exist. Updating status to processing...`);
  // Update status to processing
  await adminClient
    .from('step_media')
    .update({ image_status: 'processing' })
    .eq('step_id', stepId);

  log(`Status updated. Getting Runware service...`);
  // Generate the image
  const runware = getRunwareService();
  
  log(`Calling runware.generateStepImage()...`);
  const startTime = Date.now();
  const { imageBuffer, prompt } = await runware.generateStepImage(
    instruction,
    recipeTitle,
    stepIndex,
    modelArchitecture,
    modelAIR
  );
  const duration = Date.now() - startTime;
  log(`Image generation completed in ${duration}ms. Buffer size: ${imageBuffer.length} bytes`);
  log(`Prompt used: ${prompt.substring(0, 100)}...`);

  log(`Uploading to storage at: ${imagePath}`);
  // Upload to storage
  await storage.putObject(imagePath, 'image/webp', imageBuffer);
  log(`Upload complete!`);

  // Update step_media record
  log(`Updating step_media record for step ${stepId} to completed...`);
  const { error: updateError } = await adminClient
    .from('step_media')
    .update({
      image_path: imagePath,
      image_status: 'completed',
      generation_prompt: prompt,
    })
    .eq('step_id', stepId);
  
  if (updateError) {
    log(`ERROR updating step_media: ${updateError.message}`);
    throw new Error(`Failed to update step_media: ${updateError.message}`);
  }
  log(`✅ step_media updated successfully for step ${stepId}`);
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
