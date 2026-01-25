'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { toast } from '@/components/ui/toaster';
import {
  ChefHat,
  Plus,
  Heart,
  Clock,
  Users,
  Play,
  Loader2,
  BookOpen,
  Star,
  CheckCircle2,
} from 'lucide-react';

interface UserRecipeWithRecipe {
  id: string;
  is_favorite: boolean;
  completed_at: string | null;
  progress: number;
  recipe: {
    id: string;
    title: string;
    description: string | null;
    servings: number | null;
    prep_time_minutes: number | null;
    cook_time_minutes: number | null;
    thumbnail_url: string | null;
    created_at: string;
  };
}

export default function LibraryPage() {
  const [recipes, setRecipes] = useState<UserRecipeWithRecipe[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'favorites' | 'completed'>('all');

  useEffect(() => {
    const fetchRecipes = async () => {
      try {
        const response = await fetch('/api/recipes');
        const data = await response.json();

        if (!response.ok) throw new Error(data.error);

        setRecipes(data.recipes || []);
      } catch (error) {
        toast((error as Error).message || 'Failed to load recipes', 'error');
      } finally {
        setIsLoading(false);
      }
    };

    fetchRecipes();
  }, []);

  const filteredRecipes = recipes.filter((r) => {
    if (filter === 'favorites') return r.is_favorite;
    if (filter === 'completed') return !!r.completed_at;
    return true;
  });

  const handleToggleFavorite = async (
    e: React.MouseEvent,
    recipeId: string,
    currentValue: boolean
  ) => {
    e.preventDefault();
    e.stopPropagation();

    try {
      const response = await fetch(`/api/recipes/${recipeId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isFavorite: !currentValue }),
      });

      if (!response.ok) throw new Error('Failed to update');

      setRecipes((prev) =>
        prev.map((r) =>
          r.recipe.id === recipeId ? { ...r, is_favorite: !currentValue } : r
        )
      );
    } catch (error) {
      toast('Failed to update favorite', 'error');
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-[50vh] flex items-center justify-center">
        <Loader2 className="h-8 w-8 text-orange-500 animate-spin" />
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">My Recipe Library</h1>
          <p className="text-gray-600 mt-1">
            {recipes.length} recipe{recipes.length !== 1 ? 's' : ''} saved
          </p>
        </div>
        <Link href="/import">
          <Button>
            <Plus className="h-5 w-5 mr-2" />
            Add Recipe
          </Button>
        </Link>
      </div>

      {/* Filter Tabs */}
      <div className="flex gap-2 mb-6 overflow-x-auto pb-2">
        <FilterTab
          active={filter === 'all'}
          onClick={() => setFilter('all')}
          icon={<BookOpen className="h-4 w-4" />}
          label="All Recipes"
          count={recipes.length}
        />
        <FilterTab
          active={filter === 'favorites'}
          onClick={() => setFilter('favorites')}
          icon={<Star className="h-4 w-4" />}
          label="Favorites"
          count={recipes.filter((r) => r.is_favorite).length}
        />
        <FilterTab
          active={filter === 'completed'}
          onClick={() => setFilter('completed')}
          icon={<CheckCircle2 className="h-4 w-4" />}
          label="Completed"
          count={recipes.filter((r) => r.completed_at).length}
        />
      </div>

      {/* Recipe Grid */}
      {filteredRecipes.length === 0 ? (
        <EmptyState filter={filter} />
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {filteredRecipes.map((item) => (
            <RecipeCard
              key={item.id}
              recipe={item.recipe}
              isFavorite={item.is_favorite}
              isCompleted={!!item.completed_at}
              progress={item.progress}
              onToggleFavorite={(e) =>
                handleToggleFavorite(e, item.recipe.id, item.is_favorite)
              }
            />
          ))}
        </div>
      )}
    </div>
  );
}

function FilterTab({
  active,
  onClick,
  icon,
  label,
  count,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
  count: number;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium whitespace-nowrap transition-colors ${
        active
          ? 'bg-orange-100 text-orange-700'
          : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
      }`}
    >
      {icon}
      {label}
      <span
        className={`px-2 py-0.5 rounded-full text-xs ${
          active ? 'bg-orange-200 text-orange-800' : 'bg-gray-200 text-gray-700'
        }`}
      >
        {count}
      </span>
    </button>
  );
}

function RecipeCard({
  recipe,
  isFavorite,
  isCompleted,
  progress,
  onToggleFavorite,
}: {
  recipe: UserRecipeWithRecipe['recipe'];
  isFavorite: boolean;
  isCompleted: boolean;
  progress: number;
  onToggleFavorite: (e: React.MouseEvent) => void;
}) {
  const totalTime =
    (recipe.prep_time_minutes || 0) + (recipe.cook_time_minutes || 0);

  return (
    <Link href={`/cook/${recipe.id}`}>
      <Card hover className="overflow-hidden group">
        {/* Image */}
        <div className="relative h-48 bg-gray-100">
          {recipe.thumbnail_url ? (
            <img
              src={recipe.thumbnail_url}
              alt={recipe.title}
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <ChefHat className="h-12 w-12 text-gray-300" />
            </div>
          )}

          {/* Overlay on hover */}
          <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
            <div className="w-14 h-14 rounded-full bg-white/90 flex items-center justify-center">
              <Play className="h-6 w-6 text-orange-500 ml-1" />
            </div>
          </div>

          {/* Favorite button */}
          <button
            onClick={onToggleFavorite}
            className="absolute top-3 right-3 w-8 h-8 rounded-full bg-white/90 flex items-center justify-center hover:bg-white transition-colors"
          >
            <Heart
              className={`h-4 w-4 ${
                isFavorite ? 'fill-red-500 text-red-500' : 'text-gray-600'
              }`}
            />
          </button>

          {/* Completed badge */}
          {isCompleted && (
            <div className="absolute top-3 left-3 px-2 py-1 rounded-full bg-green-500 text-white text-xs font-medium flex items-center gap-1">
              <CheckCircle2 className="h-3 w-3" />
              Done
            </div>
          )}

          {/* Progress bar */}
          {!isCompleted && progress > 0 && (
            <div className="absolute bottom-0 left-0 right-0 h-1 bg-gray-200">
              <div
                className="h-full bg-orange-500"
                style={{ width: `${progress}%` }}
              />
            </div>
          )}
        </div>

        {/* Content */}
        <div className="p-4">
          <h3 className="font-semibold text-gray-900 mb-2 line-clamp-2">
            {recipe.title}
          </h3>

          <div className="flex items-center gap-4 text-sm text-gray-500">
            {recipe.servings && (
              <span className="flex items-center gap-1">
                <Users className="h-4 w-4" />
                {recipe.servings}
              </span>
            )}
            {totalTime > 0 && (
              <span className="flex items-center gap-1">
                <Clock className="h-4 w-4" />
                {totalTime} min
              </span>
            )}
          </div>
        </div>
      </Card>
    </Link>
  );
}

function EmptyState({ filter }: { filter: 'all' | 'favorites' | 'completed' }) {
  if (filter === 'favorites') {
    return (
      <div className="text-center py-16">
        <Heart className="h-16 w-16 text-gray-300 mx-auto mb-4" />
        <h2 className="text-xl font-semibold text-gray-900 mb-2">No favorites yet</h2>
        <p className="text-gray-600 mb-6">
          Click the heart icon on recipes to add them to your favorites.
        </p>
      </div>
    );
  }

  if (filter === 'completed') {
    return (
      <div className="text-center py-16">
        <CheckCircle2 className="h-16 w-16 text-gray-300 mx-auto mb-4" />
        <h2 className="text-xl font-semibold text-gray-900 mb-2">
          No completed recipes yet
        </h2>
        <p className="text-gray-600 mb-6">
          Complete a recipe in cooking mode to see it here!
        </p>
        <Link href="/import">
          <Button>Start Cooking</Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="text-center py-16">
      <ChefHat className="h-16 w-16 text-gray-300 mx-auto mb-4" />
      <h2 className="text-xl font-semibold text-gray-900 mb-2">
        Your library is empty
      </h2>
      <p className="text-gray-600 mb-6">
        Import your first recipe to get started with AI-guided cooking!
      </p>
      <Link href="/import">
        <Button>
          <Plus className="h-5 w-5 mr-2" />
          Add Your First Recipe
        </Button>
      </Link>
    </div>
  );
}
