// ===========================================
// Runware Image Generation Service (using official SDK)
// Following best practices from: https://runware.ai/docs/libraries/javascript
// ===========================================

import { Runware, ITextToImage } from '@runware/sdk-js';
import { RunwareModelArchitecture, RUNWARE_MODELS } from '@/types';

// Verbose logging helper
function log(message: string, data?: unknown) {
  const timestamp = new Date().toISOString();
  console.log(`[RUNWARE ${timestamp}] ${message}`);
  if (data !== undefined) {
    console.log(`[RUNWARE ${timestamp}] Data:`, JSON.stringify(data, null, 2));
  }
}

function logError(message: string, error?: unknown) {
  const timestamp = new Date().toISOString();
  console.error(`[RUNWARE ERROR ${timestamp}] ${message}`);
  if (error !== undefined) {
    console.error(`[RUNWARE ERROR ${timestamp}] Error:`, error);
  }
}

export class RunwareService {
  private runware: InstanceType<typeof Runware>;
  private apiKey: string;
  private isConnected: boolean = false;

  constructor() {
    log('Initializing RunwareService with official SDK...');
    this.apiKey = process.env.RUNWARE_API_KEY!;
    if (!this.apiKey) {
      logError('RUNWARE_API_KEY is not configured!');
      throw new Error('RUNWARE_API_KEY is not configured');
    }
    log(`API Key configured: ${this.apiKey.substring(0, 8)}...${this.apiKey.substring(this.apiKey.length - 4)}`);
    
    // Initialize the Runware SDK with recommended settings
    // Using synchronous initialization - connection established on-demand
    this.runware = new Runware({ 
      apiKey: this.apiKey,
      shouldReconnect: true,        // Enable automatic reconnection (recommended)
      globalMaxRetries: 3,          // Default retry attempts
      timeoutDuration: 120000,      // 2 minutes timeout for image generation
    });
    log('Runware SDK instance created with shouldReconnect=true');
  }

  /**
   * Ensures WebSocket connection is established before operations.
   * This is a best practice from the docs for reliability.
   */
  private async ensureReady(): Promise<void> {
    if (!this.isConnected) {
      log('Ensuring WebSocket connection is established...');
      await this.runware.ensureConnection();
      this.isConnected = true;
      log('WebSocket connection established successfully');
    }
  }

  async generateImage(options: {
    positivePrompt: string;
    model: string;
    width?: number;
    height?: number;
    outputFormat?: 'WEBP' | 'PNG' | 'JPG';
    steps?: number;
  }): Promise<Buffer> {
    const requestId = crypto.randomUUID();
    const startTime = Date.now();
    
    log(`[${requestId}] ========== STARTING IMAGE GENERATION ==========`);
    
    const {
      positivePrompt,
      model,
      width = 1024,
      height = 1024,
      outputFormat = 'WEBP',
      steps = 28,
    } = options;

    log(`[${requestId}] Request parameters:`, {
      promptLength: positivePrompt.length,
      promptPreview: positivePrompt.substring(0, 100) + '...',
      model,
      width,
      height,
      outputFormat,
      steps,
    });

    try {
      // Ensure connection is ready before making request
      await this.ensureReady();
      
      log(`[${requestId}] Calling runware.requestImages()...`);
      
      // Use requestImages (the primary method per docs)
      const images = await this.runware.requestImages({
        positivePrompt,
        model,
        width,
        height,
        outputFormat,
        steps,
        outputType: 'base64Data',
        numberResults: 1,
        // Per-request retry override for important operations
        retry: 3,
        // Include cost for monitoring
        includeCost: true,
      });

      const duration = Date.now() - startTime;
      log(`[${requestId}] SDK call completed in ${duration}ms`);
      
      if (!images || images.length === 0) {
        logError(`[${requestId}] No images returned from SDK`);
        throw new Error('No image result from Runware');
      }

      const result = images[0] as ITextToImage;
      log(`[${requestId}] Result received:`, {
        hasImageBase64Data: !!result.imageBase64Data,
        hasImageURL: !!result.imageURL,
        hasImageDataURI: !!result.imageDataURI,
        taskUUID: result.taskUUID,
        imageUUID: result.imageUUID,
        cost: result.cost,
      });

      // Handle base64 response (preferred for server-side processing)
      if (result.imageBase64Data) {
        log(`[${requestId}] Converting base64 to Buffer...`);
        const buffer = Buffer.from(result.imageBase64Data, 'base64');
        log(`[${requestId}] ✅ SUCCESS! Buffer size: ${buffer.length} bytes, cost: ${result.cost}`);
        log(`[${requestId}] Total duration: ${duration}ms`);
        return buffer;
      }

      // Handle URL response - download the image
      if (result.imageURL) {
        log(`[${requestId}] Downloading image from URL: ${result.imageURL}`);
        const downloadStartTime = Date.now();
        const imageResponse = await fetch(result.imageURL);
        const downloadDuration = Date.now() - downloadStartTime;
        log(`[${requestId}] Download completed in ${downloadDuration}ms, status: ${imageResponse.status}`);
        
        if (!imageResponse.ok) {
          logError(`[${requestId}] Failed to download image`, {
            status: imageResponse.status,
            url: result.imageURL,
          });
          throw new Error('Failed to download generated image');
        }
        
        const buffer = Buffer.from(await imageResponse.arrayBuffer());
        const totalDuration = Date.now() - startTime;
        log(`[${requestId}] ✅ SUCCESS! Buffer size: ${buffer.length} bytes`);
        log(`[${requestId}] Total duration: ${totalDuration}ms`);
        return buffer;
      }

      // Handle dataURI response
      if (result.imageDataURI) {
        log(`[${requestId}] Converting dataURI to Buffer...`);
        // Extract base64 from data URI (format: data:image/webp;base64,...)
        const base64Data = result.imageDataURI.split(',')[1];
        const buffer = Buffer.from(base64Data, 'base64');
        log(`[${requestId}] ✅ SUCCESS! Buffer size: ${buffer.length} bytes`);
        return buffer;
      }

      logError(`[${requestId}] Invalid response: no image data`, result);
      throw new Error('Invalid Runware response: no image data');
      
    } catch (error) {
      const totalDuration = Date.now() - startTime;
      // Handle SDK error format
      const sdkError = error as Error & { taskUUID?: string };
      logError(`[${requestId}] ❌ FAILED after ${totalDuration}ms`, {
        message: sdkError.message,
        taskUUID: sdkError.taskUUID,
      });
      throw error;
    }
  }

  // Generate a cooking step image with an optimized prompt
  async generateStepImage(
    stepInstruction: string,
    recipeTitle: string,
    stepIndex: number,
    modelArchitecture: RunwareModelArchitecture,
    modelAIR: string
  ): Promise<{ imageBuffer: Buffer; prompt: string }> {
    log(`========== GENERATING STEP IMAGE ==========`);
    log(`Recipe: ${recipeTitle}`);
    log(`Step index: ${stepIndex}`);
    log(`Instruction: ${stepInstruction.substring(0, 100)}...`);
    log(`Model AIR: ${modelAIR}`);
    
    // Create an optimized prompt for food/cooking imagery
    const prompt = this.createStepPrompt(stepInstruction, recipeTitle, stepIndex);
    log(`Generated prompt: ${prompt}`);

    const imageBuffer = await this.generateImage({
      positivePrompt: prompt,
      model: modelAIR,
      width: 1024,
      height: 1024,
      outputFormat: 'WEBP',
    });

    log(`Step image generated successfully, size: ${imageBuffer.length} bytes`);
    return { imageBuffer, prompt };
  }

  private createStepPrompt(
    instruction: string,
    recipeTitle: string,
    stepIndex: number
  ): string {
    // Clean and truncate instruction for prompt
    const cleanInstruction = instruction
      .replace(/\d+\.\s*/, '') // Remove step numbers
      .substring(0, 200);

    // Consistent cookware description for visual continuity across all steps
    const consistentCookware = 'using a classic stainless steel sauté pan with copper bottom, wooden cutting board, and matching stainless steel utensils on a marble countertop';

    return `Professional food photography style, cooking step ${stepIndex + 1} for ${recipeTitle}: ${cleanInstruction}. ${consistentCookware}. Clean modern kitchen background, warm golden lighting, appetizing, high detail, photorealistic, 4k quality`;
  }

  static getModelConfig(architecture: RunwareModelArchitecture) {
    return RUNWARE_MODELS[architecture] || RUNWARE_MODELS['flux2dev'];
  }
}

// Singleton instance
let runwareInstance: RunwareService | null = null;

export function getRunwareService(): RunwareService {
  if (!runwareInstance) {
    log('Creating new RunwareService singleton instance');
    runwareInstance = new RunwareService();
  }
  return runwareInstance;
}
