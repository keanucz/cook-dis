import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase/server';

export async function GET(request: NextRequest) {
  try {
    const supabase = await createSupabaseServerClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get user's recipes with their relationship data
    const { data: userRecipes, error } = await supabase
      .from('user_recipes')
      .select(`
        *,
        recipe:recipes (
          id,
          title,
          description,
          servings,
          prep_time_minutes,
          cook_time_minutes,
          thumbnail_url,
          source_url,
          created_at
        )
      `)
      .eq('user_id', user.id)
      .eq('is_saved', true)
      .order('created_at', { ascending: false });

    if (error) {
      throw error;
    }

    return NextResponse.json({ recipes: userRecipes });
  } catch (error) {
    console.error('Fetch recipes error:', error);
    return NextResponse.json(
      { error: (error as Error).message || 'Failed to fetch recipes' },
      { status: 500 }
    );
  }
}
