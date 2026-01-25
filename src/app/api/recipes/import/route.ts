import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServerClient, createSupabaseAdminClient } from '@/lib/supabase/server';
import { getRecipeUrlParser } from '@/lib/services/recipe-parser';
import { getRecipeSearchProvider } from '@/lib/services/recipe-search';
import { RUNWARE_MODELS, RunwareModelArchitecture } from '@/types';
import { v4 as uuid } from 'uuid';

interface ImportRequest {
  url?: string;
  searchResultId?: string;
  searchProvider?: 'spoonacular' | 'themealdb';
  modelArchitecture?: RunwareModelArchitecture;
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createSupabaseServerClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body: ImportRequest = await request.json();
    const { url, searchResultId, searchProvider, modelArchitecture } = body;

    if (!url && !searchResultId) {
      return NextResponse.json(
        { error: 'Either url or searchResultId is required' },
        { status: 400 }
      );
    }

    // Get user settings for default model
    const { data: userSettings } = await supabase
      .from('user_settings')
      .select('*')
      .eq('user_id', user.id)
      .single();

    // Determine which model to use
    const selectedArchitecture = modelArchitecture || 
      userSettings?.default_model_architecture || 
      'flux2dev';
    const modelConfig = RUNWARE_MODELS[selectedArchitecture] || RUNWARE_MODELS['flux2dev'];

    // Parse the recipe
    let parsedRecipe;
    
    if (url) {
      // Import from URL
      const parser = getRecipeUrlParser();
      parsedRecipe = await parser.parseUrl(url);
      parsedRecipe.sourceUrl = url;
    } else if (searchResultId && searchProvider) {
      // Import from search result
      const provider = getRecipeSearchProvider(searchProvider);
      parsedRecipe = await provider.getRecipeById(searchResultId);
    } else {
      return NextResponse.json(
        { error: 'Invalid import request' },
        { status: 400 }
      );
    }

    if (!parsedRecipe.title || !parsedRecipe.steps || parsedRecipe.steps.length === 0) {
      return NextResponse.json(
        { error: 'Could not parse recipe. Please try a different URL.' },
        { status: 400 }
      );
    }

    // Use admin client to bypass RLS for inserts with transactions
    const adminClient = createSupabaseAdminClient();

    // Create the recipe
    const recipeId = uuid();
    const { error: recipeError } = await adminClient
      .from('recipes')
      .insert({
        id: recipeId,
        user_id: user.id,
        title: parsedRecipe.title,
        description: parsedRecipe.description,
        servings: parsedRecipe.servings,
        prep_time_minutes: parsedRecipe.prepTimeMinutes,
        cook_time_minutes: parsedRecipe.cookTimeMinutes,
        total_time_minutes: (parsedRecipe.prepTimeMinutes || 0) + (parsedRecipe.cookTimeMinutes || 0),
        source_url: parsedRecipe.sourceUrl,
        source_type: url ? 'url' : 'search',
        thumbnail_url: parsedRecipe.thumbnailUrl,
        ingredients: parsedRecipe.ingredients,
        model_architecture: modelConfig.modelArchitecture,
        model_air: modelConfig.modelAIR,
      });

    if (recipeError) {
      console.error('Recipe insert error:', recipeError);
      throw new Error('Failed to create recipe');
    }

    // Create recipe steps
    const stepsToInsert = parsedRecipe.steps.map((instruction, index) => ({
      id: uuid(),
      recipe_id: recipeId,
      step_index: index,
      instruction,
    }));

    const { data: insertedSteps, error: stepsError } = await adminClient
      .from('recipe_steps')
      .insert(stepsToInsert)
      .select();

    if (stepsError) {
      console.error('Steps insert error:', stepsError);
      throw new Error('Failed to create recipe steps');
    }

    // Create step_media entries (pending status for images only, audio is on-demand)
    const mediaToInsert = insertedSteps.map((step) => ({
      id: uuid(),
      step_id: step.id,
      recipe_id: recipeId,
      image_status: 'pending',
      audio_status: 'not_needed', // Audio is generated on-demand via TTS API
      model_architecture: modelConfig.modelArchitecture,
      model_air: modelConfig.modelAIR,
    }));

    await adminClient.from('step_media').insert(mediaToInsert);

    // Create user_recipe relationship
    await adminClient.from('user_recipes').insert({
      user_id: user.id,
      recipe_id: recipeId,
      is_saved: true,
    });

    // Create background jobs for IMAGE generation only
    // Audio is now generated on-demand via the /api/tts endpoint
    const jobs = [];
    for (const step of insertedSteps) {
      // Image generation job only
      jobs.push({
        type: 'generate_step_image',
        status: 'pending',
        payload: {
          stepId: step.id,
          recipeId,
          userId: user.id,
          stepIndex: step.step_index,
          instruction: step.instruction,
          recipeTitle: parsedRecipe.title,
          modelArchitecture: modelConfig.modelArchitecture,
          modelAIR: modelConfig.modelAIR,
        },
      });
    }

    await adminClient.from('jobs').insert(jobs);

    // Trigger the worker to start processing jobs immediately
    // Fire and forget - don't wait for it to complete
    const cronSecret = process.env.CRON_SECRET;
    if (cronSecret) {
      const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
      fetch(`${baseUrl}/api/jobs/worker`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${cronSecret}`,
          'Content-Type': 'application/json',
        },
      }).catch((err) => {
        console.error('Failed to trigger worker:', err);
      });
      console.log('[IMPORT] Triggered worker to process jobs');
    } else {
      console.warn('[IMPORT] CRON_SECRET not set, worker not triggered automatically');
    }

    return NextResponse.json({
      success: true,
      recipeId,
      title: parsedRecipe.title,
      stepsCount: parsedRecipe.steps.length,
    });
  } catch (error) {
    console.error('Recipe import error:', error);
    return NextResponse.json(
      { error: (error as Error).message || 'Failed to import recipe' },
      { status: 500 }
    );
  }
}
