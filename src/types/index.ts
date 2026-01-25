// ===========================================
// Core Types for Cook-Dis Application
// ===========================================

// ----- Runware Model Configuration -----
export type RunwareModelArchitecture = 'flux_2_max' | 'flux2dev';

export interface RunwareModelConfig {
  name: string;
  modelArchitecture: RunwareModelArchitecture;
  modelAIR: string;
  description: string;
}

export const RUNWARE_MODELS: Record<string, RunwareModelConfig> = {
  'flux_2_max': {
    name: 'FLUX.2 Max',
    modelArchitecture: 'flux_2_max',
    modelAIR: 'bfl:7@1',
    description: 'Highest quality, slower generation',
  },
  'flux2dev': {
    name: 'FLUX.2 Dev',
    modelArchitecture: 'flux2dev',
    modelAIR: 'runware:400@1',
    description: 'Fast generation, great quality',
  },
} as const;

// ----- Recipe Types -----
export interface Recipe {
  id: string;
  userId: string;
  title: string;
  description?: string;
  servings?: number;
  prepTimeMinutes?: number;
  cookTimeMinutes?: number;
  totalTimeMinutes?: number;
  sourceUrl?: string;
  sourceType: 'url' | 'search' | 'manual';
  thumbnailUrl?: string;
  ingredients: Ingredient[];
  modelArchitecture: RunwareModelArchitecture;
  modelAIR: string;
  createdAt: string;
  updatedAt: string;
}

export interface Ingredient {
  name: string;
  amount?: string;
  unit?: string;
  notes?: string;
}

export interface RecipeStep {
  id: string;
  recipeId: string;
  stepIndex: number;
  instruction: string;
  tips?: string;
  timerMinutes?: number;
  createdAt: string;
}

export interface StepMedia {
  id: string;
  stepId: string;
  recipeId: string;
  imagePath?: string;
  imageUrl?: string;
  audioPath?: string;
  audioUrl?: string;
  imageStatus: MediaStatus;
  audioStatus: MediaStatus;
  imageError?: string;
  audioError?: string;
  modelArchitecture?: RunwareModelArchitecture;
  modelAIR?: string;
  generationPrompt?: string;
  createdAt: string;
  updatedAt: string;
}

export type MediaStatus = 'pending' | 'processing' | 'completed' | 'failed';

// ----- User Recipe Relationship -----
export interface UserRecipe {
  id: string;
  userId: string;
  recipeId: string;
  isSaved: boolean;
  isFavorite: boolean;
  completedAt?: string;
  lastViewedStep: number;
  progress: number; // 0-100
  createdAt: string;
  updatedAt: string;
}

// ----- User Settings -----
export interface UserSettings {
  id: string;
  userId: string;
  defaultModelArchitecture: RunwareModelArchitecture;
  defaultModelAIR: string;
  autoplayNarration: boolean;
  mutedByDefault: boolean;
  preferredVoiceId?: string;
  recipeSearchProvider: 'spoonacular' | 'themealdb';
  createdAt: string;
  updatedAt: string;
}

// ----- Background Jobs -----
export type JobType = 'generate_step_image' | 'generate_step_audio';
export type JobStatus = 'pending' | 'processing' | 'completed' | 'failed';

export interface Job {
  id: string;
  type: JobType;
  status: JobStatus;
  payload: Record<string, unknown>;
  attempts: number;
  maxAttempts: number;
  runAt: string;
  lastError?: string;
  completedAt?: string;
  createdAt: string;
  updatedAt: string;
}

// ----- Recipe Import/Search -----
export interface RecipeSearchResult {
  id: string;
  title: string;
  image?: string;
  source: string;
  sourceUrl?: string;
  provider: 'spoonacular' | 'themealdb';
}

export interface ParsedRecipe {
  title: string;
  description?: string;
  servings?: number;
  prepTimeMinutes?: number;
  cookTimeMinutes?: number;
  ingredients: Ingredient[];
  steps: string[];
  sourceUrl?: string;
  thumbnailUrl?: string;
}

// ----- Media Storage -----
export interface MediaStorageResult {
  path: string;
  url: string;
}

export interface MediaStorageProvider {
  putObject(
    path: string,
    contentType: string,
    data: Buffer | Uint8Array | ReadableStream
  ): Promise<MediaStorageResult>;
  
  getPublicUrl(path: string): string;
  
  getSignedUrl(path: string, expiresInSeconds?: number): Promise<string>;
  
  exists(path: string): Promise<boolean>;
  
  deleteObject(path: string): Promise<void>;
}

// ----- API Response Types -----
export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
}

// ----- Cooking Mode State -----
export interface CookingModeState {
  recipe: Recipe;
  steps: RecipeStep[];
  stepMedia: Record<string, StepMedia>;
  currentStepIndex: number;
  isPlaying: boolean;
  isMuted: boolean;
  isCompleted: boolean;
}
