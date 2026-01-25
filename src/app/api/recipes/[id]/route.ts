import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { getMediaStorage } from '@/lib/storage';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = await createSupabaseServerClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get the recipe with steps and media
    const { data: recipe, error: recipeError } = await supabase
      .from('recipes')
      .select('*')
      .eq('id', id)
      .eq('user_id', user.id)
      .single();

    if (recipeError || !recipe) {
      return NextResponse.json({ error: 'Recipe not found' }, { status: 404 });
    }

    // Get steps
    const { data: steps, error: stepsError } = await supabase
      .from('recipe_steps')
      .select('*')
      .eq('recipe_id', id)
      .order('step_index', { ascending: true });

    if (stepsError) {
      throw stepsError;
    }

    // Get media for all steps
    const { data: stepMedia, error: mediaError } = await supabase
      .from('step_media')
      .select('*')
      .eq('recipe_id', id);

    if (mediaError) {
      throw mediaError;
    }

    // Get signed URLs for media if needed
    const storage = getMediaStorage();
    const mediaWithUrls = await Promise.all(
      stepMedia.map(async (media) => {
        let imageUrl = null;
        let audioUrl = null;

        if (media.image_path && media.image_status === 'completed') {
          try {
            imageUrl = await storage.getSignedUrl(media.image_path, 3600);
          } catch (e) {
            console.error('Failed to get signed URL for image:', e);
          }
        }

        if (media.audio_path && media.audio_status === 'completed') {
          try {
            audioUrl = await storage.getSignedUrl(media.audio_path, 3600);
          } catch (e) {
            console.error('Failed to get signed URL for audio:', e);
          }
        }

        // Transform snake_case to camelCase for frontend
        return {
          id: media.id,
          stepId: media.step_id,
          recipeId: media.recipe_id,
          imagePath: media.image_path,
          audioPath: media.audio_path,
          imageStatus: media.image_status,
          audioStatus: media.audio_status,
          imageError: media.image_error,
          audioError: media.audio_error,
          modelArchitecture: media.model_architecture,
          modelAir: media.model_air,
          generationPrompt: media.generation_prompt,
          createdAt: media.created_at,
          updatedAt: media.updated_at,
          imageUrl,
          audioUrl,
        };
      })
    );

    // Get user recipe relationship
    const { data: userRecipe } = await supabase
      .from('user_recipes')
      .select('*')
      .eq('recipe_id', id)
      .eq('user_id', user.id)
      .single();

    return NextResponse.json({
      recipe,
      steps,
      stepMedia: mediaWithUrls,
      userRecipe,
    });
  } catch (error) {
    console.error('Fetch recipe error:', error);
    return NextResponse.json(
      { error: (error as Error).message || 'Failed to fetch recipe' },
      { status: 500 }
    );
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = await createSupabaseServerClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { isFavorite, lastViewedStep, progress, completedAt } = body;

    const updateData: Record<string, unknown> = {};
    if (typeof isFavorite === 'boolean') updateData.is_favorite = isFavorite;
    if (typeof lastViewedStep === 'number') updateData.last_viewed_step = lastViewedStep;
    if (typeof progress === 'number') updateData.progress = progress;
    if (completedAt) updateData.completed_at = completedAt;

    const { error } = await supabase
      .from('user_recipes')
      .update(updateData)
      .eq('recipe_id', id)
      .eq('user_id', user.id);

    if (error) {
      throw error;
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Update recipe error:', error);
    return NextResponse.json(
      { error: (error as Error).message || 'Failed to update recipe' },
      { status: 500 }
    );
  }
}
