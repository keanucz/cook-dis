'use client';

import { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from '@/components/ui/toaster';
import { RecipeSearchResult } from '@/types';
import {
  Search as SearchIcon,
  ChefHat,
  Loader2,
  ArrowRight,
} from 'lucide-react';

function SearchContent() {
  const searchParams = useSearchParams();
  const initialQuery = searchParams.get('q') || '';
  
  const [query, setQuery] = useState(initialQuery);
  const [results, setResults] = useState<RecipeSearchResult[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [provider, setProvider] = useState<'spoonacular' | 'themealdb'>('themealdb');

  useEffect(() => {
    if (initialQuery) {
      handleSearch();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSearch = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!query.trim()) return;

    setIsLoading(true);
    setHasSearched(true);

    try {
      const response = await fetch(
        `/api/recipes/search?q=${encodeURIComponent(query)}&provider=${provider}`
      );
      const data = await response.json();

      if (!response.ok) throw new Error(data.error);

      setResults(data.results || []);
    } catch (error) {
      toast((error as Error).message || 'Search failed', 'error');
      setResults([]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="text-center mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Search Recipes</h1>
        <p className="text-gray-600">Find recipes to cook with AI guidance</p>
      </div>

      {/* Search Form */}
      <form onSubmit={handleSearch} className="space-y-4 mb-8">
        <div className="flex gap-2">
          <Input
            type="text"
            placeholder="Search for recipes (e.g., pasta, chicken curry, tacos)"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="flex-1"
          />
          <Button type="submit" isLoading={isLoading}>
            <SearchIcon className="h-5 w-5 mr-2" />
            Search
          </Button>
        </div>

        <div className="flex gap-2 justify-center">
          <button
            type="button"
            onClick={() => setProvider('themealdb')}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
              provider === 'themealdb'
                ? 'bg-orange-100 text-orange-700'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            TheMealDB (Free)
          </button>
          <button
            type="button"
            onClick={() => setProvider('spoonacular')}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
              provider === 'spoonacular'
                ? 'bg-orange-100 text-orange-700'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            Spoonacular
          </button>
        </div>
      </form>

      {/* Results */}
      {isLoading ? (
        <div className="text-center py-12">
          <Loader2 className="h-8 w-8 text-orange-500 animate-spin mx-auto mb-4" />
          <p className="text-gray-600">Searching...</p>
        </div>
      ) : hasSearched && results.length === 0 ? (
        <div className="text-center py-12">
          <ChefHat className="h-16 w-16 text-gray-300 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-gray-900 mb-2">No recipes found</h2>
          <p className="text-gray-600">Try a different search term or provider.</p>
        </div>
      ) : results.length > 0 ? (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {results.map((result) => (
            <Link
              key={result.id}
              href={`/import?mode=search&provider=${result.provider}&id=${result.id}`}
            >
              <Card hover className="overflow-hidden h-full">
                <div className="h-40 bg-gray-100">
                  {result.image ? (
                    <img
                      src={result.image}
                      alt={result.title}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <ChefHat className="h-12 w-12 text-gray-300" />
                    </div>
                  )}
                </div>
                <div className="p-4">
                  <h3 className="font-semibold text-gray-900 mb-2 line-clamp-2">
                    {result.title}
                  </h3>
                  <p className="text-sm text-gray-500 mb-3">
                    From {result.provider === 'themealdb' ? 'TheMealDB' : 'Spoonacular'}
                  </p>
                  <div className="flex items-center text-orange-600 text-sm font-medium">
                    Import & Cook
                    <ArrowRight className="h-4 w-4 ml-1" />
                  </div>
                </div>
              </Card>
            </Link>
          ))}
        </div>
      ) : (
        <div className="text-center py-12">
          <SearchIcon className="h-16 w-16 text-gray-300 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-gray-900 mb-2">
            Discover new recipes
          </h2>
          <p className="text-gray-600 max-w-md mx-auto">
            Search for any dish, ingredient, or cuisine. We&apos;ll help you cook it with 
            step-by-step AI guidance.
          </p>
        </div>
      )}
    </div>
  );
}

export default function SearchPage() {
  return (
    <Suspense fallback={
      <div className="flex items-center justify-center min-h-[50vh]">
        <Loader2 className="h-8 w-8 text-orange-500 animate-spin" />
      </div>
    }>
      <SearchContent />
    </Suspense>
  );
}
