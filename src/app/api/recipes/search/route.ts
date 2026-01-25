import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { getRecipeSearchProvider } from '@/lib/services/recipe-search';

export async function GET(request: NextRequest) {
  try {
    const supabase = await createSupabaseServerClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const searchParams = request.nextUrl.searchParams;
    const query = searchParams.get('q');
    const provider = searchParams.get('provider') as 'spoonacular' | 'themealdb' | undefined;

    if (!query) {
      return NextResponse.json({ error: 'Query is required' }, { status: 400 });
    }

    const searchProvider = getRecipeSearchProvider(provider);
    const results = await searchProvider.search(query);

    return NextResponse.json({ results });
  } catch (error) {
    console.error('Recipe search error:', error);
    return NextResponse.json(
      { error: (error as Error).message || 'Failed to search recipes' },
      { status: 500 }
    );
  }
}
