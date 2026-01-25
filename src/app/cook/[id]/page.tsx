'use client';

import { useState, useEffect, useRef, useCallback, use } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { toast } from '@/components/ui/toaster';
import { Recipe, RecipeStep, StepMedia } from '@/types';
import {
  ChevronLeft,
  ChevronRight,
  Play,
  Pause,
  Volume2,
  VolumeX,
  RefreshCw,
  Home,
  ChefHat,
  Clock,
  Users,
  Loader2,
  Check,
  AlertCircle,
  PartyPopper,
  Image as ImageIcon,
} from 'lucide-react';
import confetti from 'canvas-confetti';

interface CookingPageProps {
  params: Promise<{ id: string }>;
}

interface RecipeData {
  recipe: Recipe;
  steps: RecipeStep[];
  stepMedia: (StepMedia & { imageUrl?: string; audioUrl?: string })[];
  userRecipe: {
    last_viewed_step: number;
    progress: number;
    completed_at?: string;
  };
}

export default function CookingPage({ params }: CookingPageProps) {
  const { id } = use(params);
  const router = useRouter();
  const audioRef = useRef<HTMLAudioElement>(null);
  
  const [data, setData] = useState<RecipeData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [currentStep, setCurrentStep] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [isCompleted, setIsCompleted] = useState(false);
  const [isRetrying, setIsRetrying] = useState<string | null>(null);
  const [isGeneratingAudio, setIsGeneratingAudio] = useState(false);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);

  // Calculate image generation progress
  const getImageProgress = useCallback(() => {
    if (!data) return { completed: 0, total: 0, allDone: false };
    const total = data.stepMedia.length;
    const completed = data.stepMedia.filter(m => m.imageStatus === 'completed').length;
    const allDone = data.stepMedia.every(m => m.imageStatus === 'completed' || m.imageStatus === 'failed');
    return { completed, total, allDone };
  }, [data]);

  // Fetch recipe data
  const fetchData = useCallback(async () => {
    try {
      const response = await fetch(`/api/recipes/${id}`);
      const json = await response.json();

      if (!response.ok) throw new Error(json.error);

      setData(json);
      setCurrentStep(json.userRecipe?.last_viewed_step || 0);
      setIsCompleted(!!json.userRecipe?.completed_at);
    } catch (error) {
      toast((error as Error).message || 'Failed to load recipe', 'error');
      router.push('/library');
    } finally {
      setIsLoading(false);
    }
  }, [id, router]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Poll for image generation updates (faster polling - every 2 seconds)
  useEffect(() => {
    if (!data) return;

    const { allDone } = getImageProgress();
    
    if (!allDone) {
      const interval = setInterval(fetchData, 2000); // Poll every 2 seconds for images
      return () => clearInterval(interval);
    }
  }, [data, fetchData, getImageProgress]);

  // Update progress when step changes
  useEffect(() => {
    if (!data) return;

    const progress = Math.round(((currentStep + 1) / data.steps.length) * 100);
    
    fetch(`/api/recipes/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ lastViewedStep: currentStep, progress }),
    });
  }, [currentStep, data, id]);

  // Generate TTS audio on-demand when step changes or play is requested
  const generateAndPlayAudio = useCallback(async (text: string) => {
    if (isMuted || !text) return;
    
    setIsGeneratingAudio(true);
    try {
      const response = await fetch('/api/tts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text }),
      });

      if (!response.ok) {
        throw new Error('Failed to generate audio');
      }

      const audioBlob = await response.blob();
      const url = URL.createObjectURL(audioBlob);
      
      // Clean up previous audio URL
      if (audioUrl) {
        URL.revokeObjectURL(audioUrl);
      }
      
      setAudioUrl(url);
      setIsPlaying(true);
    } catch (error) {
      console.error('TTS error:', error);
      toast('Failed to generate audio', 'error');
    } finally {
      setIsGeneratingAudio(false);
    }
  }, [isMuted, audioUrl]);

  // Handle audio playback
  useEffect(() => {
    if (!audioRef.current || !audioUrl) return;

    if (isPlaying && !isMuted) {
      audioRef.current.play().catch(() => setIsPlaying(false));
    } else {
      audioRef.current.pause();
    }
  }, [isPlaying, isMuted, audioUrl]);

  // Cleanup audio URL on unmount
  useEffect(() => {
    return () => {
      if (audioUrl) {
        URL.revokeObjectURL(audioUrl);
      }
    };
  }, [audioUrl]);

  const currentStepData = data?.steps[currentStep];
  const currentMedia = data?.stepMedia.find(
    (m) => m.stepId === currentStepData?.id
  );

  const goToStep = (step: number) => {
    if (!data) return;
    const newStep = Math.max(0, Math.min(step, data.steps.length - 1));
    setCurrentStep(newStep);
    setIsPlaying(false);
    setAudioUrl(null);
  };

  const handlePlayPause = () => {
    if (isPlaying) {
      setIsPlaying(false);
    } else if (currentStepData) {
      generateAndPlayAudio(currentStepData.instruction);
    }
  };

  const handleComplete = async () => {
    // Trigger confetti
    const duration = 3000;
    const end = Date.now() + duration;

    const frame = () => {
      confetti({
        particleCount: 3,
        angle: 60,
        spread: 55,
        origin: { x: 0 },
        colors: ['#f97316', '#fbbf24', '#ef4444'],
      });
      confetti({
        particleCount: 3,
        angle: 120,
        spread: 55,
        origin: { x: 1 },
        colors: ['#f97316', '#fbbf24', '#ef4444'],
      });

      if (Date.now() < end) {
        requestAnimationFrame(frame);
      }
    };
    frame();

    // Mark as completed
    await fetch(`/api/recipes/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        completedAt: new Date().toISOString(),
        progress: 100,
      }),
    });

    setIsCompleted(true);
  };

  const handleRetryMedia = async (stepId: string) => {
    setIsRetrying(stepId);
    try {
      const response = await fetch(`/api/steps/${stepId}/retry`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'image' }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error);
      }

      toast('Image regeneration started. Please wait...', 'success');
      fetchData();
    } catch (error) {
      toast((error as Error).message || 'Failed to retry', 'error');
    } finally {
      setIsRetrying(null);
    }
  };

  // Initial loading state
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-900">
        <div className="text-center">
          <Loader2 className="h-12 w-12 text-orange-500 animate-spin mx-auto mb-4" />
          <p className="text-white">Loading recipe...</p>
        </div>
      </div>
    );
  }

  if (!data) {
    return null;
  }

  // Check if images are still being generated - show loading screen
  const { completed, total, allDone } = getImageProgress();
  
  if (!allDone) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 p-4">
        <div className="text-center max-w-lg">
          <div className="relative mb-8">
            <div className="w-32 h-32 mx-auto rounded-full bg-gray-800 flex items-center justify-center">
              <ImageIcon className="w-16 h-16 text-gray-600" />
            </div>
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="w-36 h-36 rounded-full border-4 border-transparent border-t-orange-500 animate-spin" />
            </div>
          </div>
          
          <h1 className="text-3xl font-bold text-white mb-4">
            Preparing Your Recipe
          </h1>
          
          <p className="text-gray-400 mb-8">
            We&apos;re generating beautiful AI images for each step of <span className="text-orange-400 font-semibold">{data.recipe.title}</span>. This usually takes 1-2 minutes.
          </p>

          {/* Progress bar */}
          <div className="w-full max-w-sm mx-auto mb-4">
            <div className="flex justify-between text-sm text-gray-400 mb-2">
              <span>Generating images...</span>
              <span>{completed} / {total}</span>
            </div>
            <div className="h-3 bg-gray-700 rounded-full overflow-hidden">
              <div 
                className="h-full bg-gradient-to-r from-orange-500 to-amber-500 transition-all duration-500 ease-out"
                style={{ width: `${(completed / total) * 100}%` }}
              />
            </div>
          </div>

          {/* Step indicators */}
          <div className="flex flex-wrap justify-center gap-2 mb-8">
            {data.stepMedia.map((media, index) => (
              <div
                key={media.id}
                className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium transition-all ${
                  media.imageStatus === 'completed'
                    ? 'bg-green-500 text-white'
                    : media.imageStatus === 'failed'
                    ? 'bg-red-500 text-white'
                    : media.imageStatus === 'processing'
                    ? 'bg-orange-500 text-white animate-pulse'
                    : 'bg-gray-700 text-gray-400'
                }`}
              >
                {media.imageStatus === 'completed' ? (
                  <Check className="w-4 h-4" />
                ) : media.imageStatus === 'failed' ? (
                  <AlertCircle className="w-4 h-4" />
                ) : (
                  index + 1
                )}
              </div>
            ))}
          </div>

          <Button
            onClick={() => router.push('/library')}
            variant="ghost"
            className="text-gray-400 hover:text-white"
          >
            <Home className="h-5 w-5 mr-2" />
            Return to Library
          </Button>
        </div>
      </div>
    );
  }

  // Completion Screen
  if (isCompleted) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-orange-500 to-amber-500 p-4">
        <div className="text-center text-white max-w-lg">
          <PartyPopper className="h-24 w-24 mx-auto mb-6" />
          <h1 className="text-4xl font-bold mb-4">Congratulations! 🎉</h1>
          <p className="text-xl mb-2">You&apos;ve completed</p>
          <h2 className="text-3xl font-bold mb-8">{data.recipe.title}</h2>
          <p className="text-lg opacity-90 mb-8">
            Great job! Your dish is ready to enjoy. This recipe has been added to your completed recipes.
          </p>
          <div className="flex gap-4 justify-center">
            <Button
              onClick={() => router.push('/library')}
              variant="secondary"
              size="lg"
            >
              <Home className="h-5 w-5 mr-2" />
              Go to Library
            </Button>
            <Button
              onClick={() => {
                setIsCompleted(false);
                setCurrentStep(0);
              }}
              className="bg-white text-orange-600 hover:bg-gray-100"
              size="lg"
            >
              <RefreshCw className="h-5 w-5 mr-2" />
              Cook Again
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-900 text-white flex flex-col">
      {/* Header */}
      <header className="flex items-center justify-between px-4 py-3 bg-gray-800 border-b border-gray-700">
        <button
          onClick={() => router.push('/library')}
          className="flex items-center gap-2 text-gray-300 hover:text-white transition-colors"
        >
          <Home className="h-5 w-5" />
          <span className="hidden sm:inline">Exit</span>
        </button>

        <div className="text-center flex-1 px-4">
          <h1 className="text-lg font-semibold truncate">{data.recipe.title}</h1>
          <div className="flex items-center justify-center gap-4 text-sm text-gray-400">
            {data.recipe.servings && (
              <span className="flex items-center gap-1">
                <Users className="h-4 w-4" />
                {data.recipe.servings} servings
              </span>
            )}
            {data.recipe.totalTimeMinutes && (
              <span className="flex items-center gap-1">
                <Clock className="h-4 w-4" />
                {data.recipe.totalTimeMinutes} min
              </span>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setIsMuted(!isMuted)}
            className="p-2 rounded-lg hover:bg-gray-700 transition-colors"
          >
            {isMuted ? (
              <VolumeX className="h-5 w-5" />
            ) : (
              <Volume2 className="h-5 w-5" />
            )}
          </button>
        </div>
      </header>

      {/* Progress Bar */}
      <div className="h-1 bg-gray-700">
        <div
          className="h-full bg-orange-500 transition-all duration-300"
          style={{ width: `${((currentStep + 1) / data.steps.length) * 100}%` }}
        />
      </div>

      {/* Main Content */}
      <main className="flex-1 flex flex-col lg:flex-row overflow-hidden">
        {/* Image Section */}
        <div className="lg:w-1/2 relative bg-gray-800 flex items-center justify-center min-h-[300px] lg:min-h-0">
          {currentMedia?.imageStatus === 'completed' && currentMedia.imageUrl ? (
            <img
              src={currentMedia.imageUrl}
              alt={`Step ${currentStep + 1}`}
              className="w-full h-full object-cover"
            />
          ) : currentMedia?.imageStatus === 'failed' ? (
            <div className="text-center p-8">
              <AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
              <p className="text-gray-400 mb-4">Image generation failed</p>
              <Button
                onClick={() => handleRetryMedia(currentStepData!.id, 'image')}
                variant="secondary"
                size="sm"
                isLoading={isRetrying === currentStepData?.id}
              >
                <RefreshCw className="h-4 w-4 mr-2" />
                Retry
              </Button>
            </div>
          ) : (
            <div className="text-center p-8">
              <div className="relative">
                <ChefHat className="h-16 w-16 text-gray-600 mx-auto mb-4" />
                <Loader2 className="h-6 w-6 text-orange-500 animate-spin absolute bottom-3 right-1/2 translate-x-6" />
              </div>
              <p className="text-gray-400">Generating image...</p>
            </div>
          )}

          {/* Step indicator overlay */}
          <div className="absolute top-4 left-4 px-3 py-1 rounded-full bg-black/50 text-sm font-medium">
            Step {currentStep + 1} of {data.steps.length}
          </div>
        </div>

        {/* Instructions Section */}
        <div className="lg:w-1/2 flex flex-col p-6 lg:p-8 overflow-y-auto">
          <div className="flex-1">
            <p className="text-2xl lg:text-3xl leading-relaxed mb-6">
              {currentStepData?.instruction}
            </p>

            {currentStepData?.tips && (
              <div className="p-4 rounded-lg bg-amber-900/30 border border-amber-700/50">
                <p className="text-amber-200 text-sm">
                  💡 <strong>Tip:</strong> {currentStepData.tips}
                </p>
              </div>
            )}

            {currentStepData?.timerMinutes && (
              <div className="mt-4 p-4 rounded-lg bg-gray-800">
                <p className="text-gray-300 flex items-center gap-2">
                  <Clock className="h-5 w-5 text-orange-500" />
                  Timer: {currentStepData.timerMinutes} minutes
                </p>
              </div>
            )}
          </div>

          {/* Audio Status - On-demand TTS */}
          <div className="mt-4 flex items-center gap-2 text-sm text-gray-400">
            {isGeneratingAudio ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Generating audio...
              </>
            ) : isPlaying ? (
              <>
                <Volume2 className="h-4 w-4 text-orange-500" />
                Playing narration...
              </>
            ) : (
              <>
                <Play className="h-4 w-4" />
                Tap play to hear narration
              </>
            )}
          </div>
        </div>
      </main>

      {/* Footer Navigation */}
      <footer className="px-4 py-4 bg-gray-800 border-t border-gray-700">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <Button
            onClick={() => goToStep(currentStep - 1)}
            disabled={currentStep === 0}
            variant="ghost"
            size="lg"
            className="text-white"
          >
            <ChevronLeft className="h-6 w-6 mr-1" />
            Back
          </Button>

          <button
            onClick={handlePlayPause}
            className="w-16 h-16 rounded-full bg-orange-500 hover:bg-orange-600 flex items-center justify-center transition-colors disabled:opacity-50"
            disabled={isGeneratingAudio || isMuted}
          >
            {isGeneratingAudio ? (
              <Loader2 className="h-8 w-8 animate-spin" />
            ) : isPlaying ? (
              <Pause className="h-8 w-8" />
            ) : (
              <Play className="h-8 w-8 ml-1" />
            )}
          </button>

          {currentStep === data.steps.length - 1 ? (
            <Button
              onClick={handleComplete}
              variant="primary"
              size="lg"
              className="bg-green-500 hover:bg-green-600"
            >
              Complete
              <Check className="h-6 w-6 ml-1" />
            </Button>
          ) : (
            <Button
              onClick={() => goToStep(currentStep + 1)}
              variant="ghost"
              size="lg"
              className="text-white"
            >
              Next
              <ChevronRight className="h-6 w-6 ml-1" />
            </Button>
          )}
        </div>
      </footer>

      {/* Hidden Audio Element for on-demand TTS */}
      {audioUrl && (
        <audio
          ref={audioRef}
          src={audioUrl}
          onEnded={() => setIsPlaying(false)}
          onError={() => setIsPlaying(false)}
        />
      )}
    </div>
  );
}
