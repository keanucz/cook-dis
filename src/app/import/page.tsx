'use client';

import { useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { toast } from '@/components/ui/toaster';
import { RUNWARE_MODELS, RunwareModelArchitecture, RecipeSearchResult } from '@/types';
import {
  Link as LinkIcon,
  Search,
  ChefHat,
  Clock,
  Sparkles,
  ArrowRight,
  Image as ImageIcon,
} from 'lucide-react';

function ImportPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [mode, setMode] = useState<'url' | 'search'>(
    searchParams.get('mode') === 'search' ? 'search' : 'url'
  );
  const [url, setUrl] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<RecipeSearchResult[]>([]);
  const [selectedResult, setSelectedResult] = useState<RecipeSearchResult | null>(null);
  const [selectedModel, setSelectedModel] = useState<RunwareModelArchitecture>('flux2dev');
  const [searchProvider, setSearchProvider] = useState<'spoonacular' | 'themealdb'>('themealdb');
  const [isLoading, setIsLoading] = useState(false);
  const [isSearching, setIsSearching] = useState(false);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;

    setIsSearching(true);
    try {
      const response = await fetch(
        `/api/recipes/search?q=${encodeURIComponent(searchQuery)}&provider=${searchProvider}`
      );
      const data = await response.json();

      if (!response.ok) throw new Error(data.error);

      setSearchResults(data.results || []);
      if (data.results?.length === 0) {
        toast('No recipes found. Try a different search term.', 'info');
      }
    } catch (error) {
      toast((error as Error).message || 'Search failed', 'error');
    } finally {
      setIsSearching(false);
    }
  };

  const handleImport = async () => {
    if (mode === 'url' && !url.trim()) {
      toast('Please enter a recipe URL', 'error');
      return;
    }

    if (mode === 'search' && !selectedResult) {
      toast('Please select a recipe from the search results', 'error');
      return;
    }

    setIsLoading(true);
    try {
      const response = await fetch('/api/recipes/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          url: mode === 'url' ? url : undefined,
          searchResultId: mode === 'search' ? selectedResult?.id : undefined,
          searchProvider: mode === 'search' ? selectedResult?.provider : undefined,
          modelArchitecture: selectedModel,
        }),
      });

      const data = await response.json();

      if (!response.ok) throw new Error(data.error);

      toast(`"${data.title}" imported! Generating images and audio...`, 'success');
      router.push(`/cook/${data.recipeId}`);
    } catch (error) {
      toast((error as Error).message || 'Import failed', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="text-center mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Add a Recipe</h1>
        <p className="text-gray-600">Import from a URL or search for recipes</p>
      </div>

      {/* Mode Toggle */}
      <div className="flex justify-center mb-8">
        <div className="inline-flex rounded-lg bg-gray-100 p-1">
          <button
            onClick={() => setMode('url')}
            className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors ${
              mode === 'url'
                ? 'bg-white text-gray-900 shadow-sm'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            <LinkIcon className="h-4 w-4" />
            Paste URL
          </button>
          <button
            onClick={() => setMode('search')}
            className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors ${
              mode === 'search'
                ? 'bg-white text-gray-900 shadow-sm'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            <Search className="h-4 w-4" />
            Search Recipes
          </button>
        </div>
      </div>

      <div className="grid lg:grid-cols-3 gap-8">
        {/* Main Content */}
        <div className="lg:col-span-2 space-y-6">
          {mode === 'url' ? (
            <Card>
              <CardHeader>
                <h2 className="text-lg font-semibold flex items-center gap-2">
                  <LinkIcon className="h-5 w-5 text-orange-500" />
                  Import from URL
                </h2>
              </CardHeader>
              <CardContent>
                <Input
                  type="url"
                  placeholder="Paste a recipe URL (e.g., https://allrecipes.com/...)"
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  className="mb-4"
                />
                <p className="text-sm text-gray-500">
                  We support most popular recipe websites including AllRecipes, Food Network, 
                  BBC Good Food, Serious Eats, and more.
                </p>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardHeader>
                <h2 className="text-lg font-semibold flex items-center gap-2">
                  <Search className="h-5 w-5 text-orange-500" />
                  Search Recipes
                </h2>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Provider Toggle */}
                <div className="flex gap-2">
                  <button
                    onClick={() => setSearchProvider('themealdb')}
                    className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                      searchProvider === 'themealdb'
                        ? 'bg-orange-100 text-orange-700'
                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    }`}
                  >
                    TheMealDB (Free)
                  </button>
                  <button
                    onClick={() => setSearchProvider('spoonacular')}
                    className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                      searchProvider === 'spoonacular'
                        ? 'bg-orange-100 text-orange-700'
                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    }`}
                  >
                    Spoonacular
                  </button>
                </div>

                <form onSubmit={handleSearch} className="flex gap-2">
                  <Input
                    type="text"
                    placeholder="Search for recipes (e.g., chicken curry, pasta)"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="flex-1"
                  />
                  <Button type="submit" isLoading={isSearching}>
                    Search
                  </Button>
                </form>

                {/* Search Results */}
                {searchResults.length > 0 && (
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mt-4">
                    {searchResults.map((result) => (
                      <button
                        key={result.id}
                        onClick={() => setSelectedResult(result)}
                        className={`relative rounded-md overflow-hidden border-2 transition-all ${
                          selectedResult?.id === result.id
                            ? 'border-orange-500 ring-2 ring-orange-200'
                            : 'border-gray-200 hover:border-gray-300'
                        }`}
                      >
                        {result.image ? (
                          <img
                            src={result.image}
                            alt={result.title}
                            className="w-full h-24 object-cover"
                          />
                        ) : (
                          <div className="w-full h-24 bg-gray-100 flex items-center justify-center">
                            <ChefHat className="h-8 w-8 text-gray-400" />
                          </div>
                        )}
                        <div className="p-2">
                          <p className="text-xs font-medium text-gray-900 line-clamp-2">
                            {result.title}
                          </p>
                        </div>
                        {selectedResult?.id === result.id && (
                          <div className="absolute top-2 right-2 w-5 h-5 bg-orange-500 rounded-full flex items-center justify-center">
                            <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                              <path
                                fillRule="evenodd"
                                d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                                clipRule="evenodd"
                              />
                            </svg>
                          </div>
                        )}
                      </button>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Import Button */}
          <Button
            onClick={handleImport}
            isLoading={isLoading}
            className="w-full py-3"
            size="lg"
            disabled={
              (mode === 'url' && !url.trim()) ||
              (mode === 'search' && !selectedResult)
            }
          >
            Import Recipe
            <ArrowRight className="ml-2 h-5 w-5" />
          </Button>
        </div>

        {/* Model Selection Sidebar */}
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <h2 className="text-lg font-semibold flex items-center gap-2">
                <ImageIcon className="h-5 w-5 text-orange-500" />
                Image Model
              </h2>
            </CardHeader>
            <CardContent className="space-y-3">
              {Object.entries(RUNWARE_MODELS).map(([key, model]) => (
                <button
                  key={key}
                  onClick={() => setSelectedModel(key as RunwareModelArchitecture)}
                  className={`w-full p-3 rounded-md border-2 text-left transition-all ${
                    selectedModel === key
                      ? 'border-orange-500 bg-orange-50'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <div className="flex items-center gap-2 mb-1">
                    <Sparkles className={`h-4 w-4 ${selectedModel === key ? 'text-orange-500' : 'text-gray-400'}`} />
                    <span className="font-medium text-gray-900">{model.name}</span>
                  </div>
                  <p className="text-xs text-gray-500">{model.description}</p>
                </button>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardContent className="py-4">
              <div className="flex items-center gap-3 text-sm text-gray-600">
                <Clock className="h-5 w-5 text-orange-500" />
                <span>Images and audio are generated in the background. You can start cooking immediately!</span>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

export default function ImportPage() {
  return (
    <Suspense fallback={
      <div className="flex items-center justify-center min-h-[50vh]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-500" />
      </div>
    }>
      <ImportPageContent />
    </Suspense>
  );
}
