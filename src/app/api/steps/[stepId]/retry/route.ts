import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServerClient, createSupabaseAdminClient } from '@/lib/supabase/server';
import { v4 as uuid } from 'uuid';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ stepId: string }> }
) {
  try {
    const { stepId } = await params;
    const supabase = await createSupabaseServerClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { type } = body; // 'image' only (audio is now on-demand via TTS API)

    // Only image retry is supported now
    if (type !== 'image') {
      return NextResponse.json({ error: 'Only image retry is supported' }, { status: 400 });
    }

    // Get the step and verify ownership
    const { data: step, error: stepError } = await supabase
      .from('recipe_steps')
      .select(`
        *,
        recipe:recipes (
          id,
          user_id,
          title,
          model_architecture,
          model_air
        )
      `)
      .eq('id', stepId)
      .single();

    if (stepError || !step) {
      return NextResponse.json({ error: 'Step not found' }, { status: 404 });
    }

    if (step.recipe.user_id !== user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const adminClient = createSupabaseAdminClient();

    // Reset image status
    await adminClient
      .from('step_media')
      .update({
        image_status: 'pending',
        image_error: null,
      })
      .eq('step_id', stepId);

    // Create new image generation job
    await adminClient.from('jobs').insert({
      id: uuid(),
      type: 'generate_step_image',
      status: 'pending',
      payload: {
        stepId: step.id,
        recipeId: step.recipe.id,
        userId: user.id,
        stepIndex: step.step_index,
        instruction: step.instruction,
        recipeTitle: step.recipe.title,
        modelArchitecture: step.recipe.model_architecture,
        modelAIR: step.recipe.model_air,
      },
    });

    return NextResponse.json({ success: true, jobsCreated: jobs.length });
  } catch (error) {
    console.error('Retry generation error:', error);
    return NextResponse.json(
      { error: (error as Error).message || 'Failed to retry generation' },
      { status: 500 }
    );
  }
}
