// ===========================================
// Runware Image Generation Service
// ===========================================

import { RunwareModelArchitecture, RUNWARE_MODELS } from '@/types';

interface RunwareImageRequest {
  positivePrompt: string;
  modelArchitecture: RunwareModelArchitecture;
  modelAIR: string;
  width?: number;
  height?: number;
  outputFormat?: 'webp' | 'png' | 'jpeg';
  steps?: number;
}

interface RunwareImageResponse {
  imageURL: string;
  imageBase64?: string;
}

export class RunwareService {
  private apiKey: string;
  private baseUrl = 'https://api.runware.ai/v1';

  constructor() {
    this.apiKey = process.env.RUNWARE_API_KEY!;
    if (!this.apiKey) {
      throw new Error('RUNWARE_API_KEY is not configured');
    }
  }

  async generateImage(options: RunwareImageRequest): Promise<Buffer> {
    const {
      positivePrompt,
      modelArchitecture,
      modelAIR,
      width = 1024,
      height = 1024,
      outputFormat = 'webp',
      steps = 28,
    } = options;

    const response = await fetch(`${this.baseUrl}/image/inference`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({
        taskType: 'imageInference',
        taskUUID: crypto.randomUUID(),
        positivePrompt,
        modelArchitecture,
        model: modelAIR,
        width,
        height,
        outputFormat,
        steps,
        outputType: 'base64',
        numberResults: 1,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Runware API error: ${response.status} - ${error}`);
    }

    const data = await response.json();
    
    // Runware returns array of results
    const result = data.data?.[0] || data[0];
    if (!result) {
      throw new Error('No image result from Runware');
    }

    // Handle base64 response
    if (result.imageBase64) {
      return Buffer.from(result.imageBase64, 'base64');
    }

    // Handle URL response - download the image
    if (result.imageURL) {
      const imageResponse = await fetch(result.imageURL);
      if (!imageResponse.ok) {
        throw new Error('Failed to download generated image');
      }
      return Buffer.from(await imageResponse.arrayBuffer());
    }

    throw new Error('Invalid Runware response: no image data');
  }

  // Generate a cooking step image with an optimized prompt
  async generateStepImage(
    stepInstruction: string,
    recipeTitle: string,
    stepIndex: number,
    modelArchitecture: RunwareModelArchitecture,
    modelAIR: string
  ): Promise<{ imageBuffer: Buffer; prompt: string }> {
    // Create an optimized prompt for food/cooking imagery
    const prompt = this.createStepPrompt(stepInstruction, recipeTitle, stepIndex);

    const imageBuffer = await this.generateImage({
      positivePrompt: prompt,
      modelArchitecture,
      modelAIR,
      width: 1024,
      height: 1024,
      outputFormat: 'webp',
    });

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

    return `Professional food photography style, cooking step ${stepIndex + 1} for ${recipeTitle}: ${cleanInstruction}. Clean kitchen background, warm lighting, appetizing, high detail, photorealistic, 4k quality`;
  }

  static getModelConfig(architecture: RunwareModelArchitecture) {
    return RUNWARE_MODELS[architecture] || RUNWARE_MODELS['flux2dev'];
  }
}

// Singleton instance
let runwareInstance: RunwareService | null = null;

export function getRunwareService(): RunwareService {
  if (!runwareInstance) {
    runwareInstance = new RunwareService();
  }
  return runwareInstance;
}
