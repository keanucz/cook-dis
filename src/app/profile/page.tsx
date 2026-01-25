'use client';

import { useState, useEffect } from 'react';
import { createSupabaseBrowserClient } from '@/lib/supabase/client';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { toast } from '@/components/ui/toaster';
import { RUNWARE_MODELS, RunwareModelArchitecture, UserSettings } from '@/types';
import {
  User,
  Settings,
  Image as ImageIcon,
  Volume2,
  ChefHat,
  Calendar,
  Loader2,
  Save,
  CheckCircle2,
  Star,
} from 'lucide-react';
import { format } from 'date-fns';

interface CompletedRecipe {
  id: string;
  completed_at: string;
  recipe: {
    id: string;
    title: string;
    thumbnail_url: string | null;
  };
}

export default function ProfilePage() {
  const supabase = createSupabaseBrowserClient();
  const [user, setUser] = useState<{ email: string; id: string } | null>(null);
  const [settings, setSettings] = useState<UserSettings | null>(null);
  const [completedRecipes, setCompletedRecipes] = useState<CompletedRecipe[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [stats, setStats] = useState({ total: 0, completed: 0, favorites: 0 });

  useEffect(() => {
    const fetchData = async () => {
      try {
        // Get user
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;
        setUser({ email: user.email || '', id: user.id });

        // Get settings
        const { data: settingsData } = await supabase
          .from('user_settings')
          .select('*')
          .eq('user_id', user.id)
          .single();

        if (settingsData) {
          setSettings({
            id: settingsData.id,
            userId: settingsData.user_id,
            defaultModelArchitecture: settingsData.default_model_architecture,
            defaultModelAIR: settingsData.default_model_air,
            autoplayNarration: settingsData.autoplay_narration,
            mutedByDefault: settingsData.muted_by_default,
            preferredVoiceId: settingsData.preferred_voice_id,
            recipeSearchProvider: settingsData.recipe_search_provider,
            createdAt: settingsData.created_at,
            updatedAt: settingsData.updated_at,
          });
        }

        // Get completed recipes
        const { data: recipesData } = await supabase
          .from('user_recipes')
          .select(`
            id,
            completed_at,
            recipe:recipes (
              id,
              title,
              thumbnail_url
            )
          `)
          .eq('user_id', user.id)
          .not('completed_at', 'is', null)
          .order('completed_at', { ascending: false })
          .limit(10);

        if (recipesData) {
          setCompletedRecipes(recipesData as unknown as CompletedRecipe[]);
        }

        // Get stats
        const { count: totalCount } = await supabase
          .from('user_recipes')
          .select('*', { count: 'exact', head: true })
          .eq('user_id', user.id);

        const { count: completedCount } = await supabase
          .from('user_recipes')
          .select('*', { count: 'exact', head: true })
          .eq('user_id', user.id)
          .not('completed_at', 'is', null);

        const { count: favoritesCount } = await supabase
          .from('user_recipes')
          .select('*', { count: 'exact', head: true })
          .eq('user_id', user.id)
          .eq('is_favorite', true);

        setStats({
          total: totalCount || 0,
          completed: completedCount || 0,
          favorites: favoritesCount || 0,
        });
      } catch (error) {
        console.error('Error fetching profile data:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, [supabase]);

  const handleSaveSettings = async () => {
    if (!settings || !user) return;

    setIsSaving(true);
    try {
      const { error } = await supabase
        .from('user_settings')
        .update({
          default_model_architecture: settings.defaultModelArchitecture,
          default_model_air: settings.defaultModelAIR,
          autoplay_narration: settings.autoplayNarration,
          muted_by_default: settings.mutedByDefault,
          recipe_search_provider: settings.recipeSearchProvider,
        })
        .eq('user_id', user.id);

      if (error) throw error;

      toast('Settings saved!', 'success');
    } catch (error) {
      toast('Failed to save settings', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  const updateSetting = <K extends keyof UserSettings>(
    key: K,
    value: UserSettings[K]
  ) => {
    if (!settings) return;
    
    const newSettings = { ...settings, [key]: value };
    
    // Update modelAIR when architecture changes
    if (key === 'defaultModelArchitecture') {
      const model = RUNWARE_MODELS[value as RunwareModelArchitecture];
      if (model) {
        newSettings.defaultModelAIR = model.modelAIR;
      }
    }
    
    setSettings(newSettings);
  };

  if (isLoading) {
    return (
      <div className="min-h-[50vh] flex items-center justify-center">
        <Loader2 className="h-8 w-8 text-orange-500 animate-spin" />
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Profile Header */}
      <div className="mb-8">
        <div className="flex items-center gap-4 mb-4">
          <div className="w-16 h-16 rounded-full bg-orange-100 flex items-center justify-center">
            <User className="h-8 w-8 text-orange-600" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">My Profile</h1>
            <p className="text-gray-600">{user?.email}</p>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-4">
          <StatCard
            icon={<ChefHat className="h-5 w-5" />}
            value={stats.total}
            label="Recipes"
          />
          <StatCard
            icon={<CheckCircle2 className="h-5 w-5" />}
            value={stats.completed}
            label="Completed"
          />
          <StatCard
            icon={<Star className="h-5 w-5" />}
            value={stats.favorites}
            label="Favorites"
          />
        </div>
      </div>

      <div className="grid lg:grid-cols-2 gap-8">
        {/* Settings */}
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <h2 className="text-lg font-semibold flex items-center gap-2">
                <Settings className="h-5 w-5 text-orange-500" />
                Preferences
              </h2>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Default Model */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  <ImageIcon className="h-4 w-4 inline mr-1" />
                  Default AI Image Model
                </label>
                <div className="space-y-2">
                  {Object.entries(RUNWARE_MODELS).map(([key, model]) => (
                    <label
                      key={key}
                      className={`flex items-center p-3 rounded-lg border-2 cursor-pointer transition-all ${
                        settings?.defaultModelArchitecture === key
                          ? 'border-orange-500 bg-orange-50'
                          : 'border-gray-200 hover:border-gray-300'
                      }`}
                    >
                      <input
                        type="radio"
                        name="model"
                        value={key}
                        checked={settings?.defaultModelArchitecture === key}
                        onChange={() =>
                          updateSetting('defaultModelArchitecture', key as RunwareModelArchitecture)
                        }
                        className="sr-only"
                      />
                      <div>
                        <p className="font-medium text-gray-900">{model.name}</p>
                        <p className="text-sm text-gray-500">{model.description}</p>
                      </div>
                    </label>
                  ))}
                </div>
              </div>

              {/* Audio Settings */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  <Volume2 className="h-4 w-4 inline mr-1" />
                  Audio Settings
                </label>
                <div className="space-y-3">
                  <label className="flex items-center gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={settings?.autoplayNarration}
                      onChange={(e) =>
                        updateSetting('autoplayNarration', e.target.checked)
                      }
                      className="w-4 h-4 text-orange-500 rounded border-gray-300 focus:ring-orange-500"
                    />
                    <span className="text-gray-700">Autoplay narration when entering a step</span>
                  </label>
                  <label className="flex items-center gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={settings?.mutedByDefault}
                      onChange={(e) =>
                        updateSetting('mutedByDefault', e.target.checked)
                      }
                      className="w-4 h-4 text-orange-500 rounded border-gray-300 focus:ring-orange-500"
                    />
                    <span className="text-gray-700">Start muted by default</span>
                  </label>
                </div>
              </div>

              {/* Search Provider */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Default Recipe Search Provider
                </label>
                <select
                  value={settings?.recipeSearchProvider}
                  onChange={(e) =>
                    updateSetting('recipeSearchProvider', e.target.value as 'spoonacular' | 'themealdb')
                  }
                  className="input"
                >
                  <option value="themealdb">TheMealDB (Free)</option>
                  <option value="spoonacular">Spoonacular</option>
                </select>
              </div>

              <Button onClick={handleSaveSettings} isLoading={isSaving} className="w-full">
                <Save className="h-4 w-4 mr-2" />
                Save Settings
              </Button>
            </CardContent>
          </Card>
        </div>

        {/* Recently Completed */}
        <div>
          <Card>
            <CardHeader>
              <h2 className="text-lg font-semibold flex items-center gap-2">
                <Calendar className="h-5 w-5 text-orange-500" />
                Recipes Done
              </h2>
            </CardHeader>
            <CardContent>
              {completedRecipes.length === 0 ? (
                <p className="text-gray-500 text-center py-8">
                  No recipes completed yet. Start cooking!
                </p>
              ) : (
                <div className="space-y-3">
                  {completedRecipes.map((item) => (
                    <div
                      key={item.id}
                      className="flex items-center gap-3 p-2 rounded-lg hover:bg-gray-50"
                    >
                      <div className="w-12 h-12 rounded-lg overflow-hidden bg-gray-100 flex-shrink-0">
                        {item.recipe.thumbnail_url ? (
                          <img
                            src={item.recipe.thumbnail_url}
                            alt={item.recipe.title}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center">
                            <ChefHat className="h-6 w-6 text-gray-300" />
                          </div>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-gray-900 truncate">
                          {item.recipe.title}
                        </p>
                        <p className="text-sm text-gray-500">
                          {format(new Date(item.completed_at), 'MMM d, yyyy')}
                        </p>
                      </div>
                      <CheckCircle2 className="h-5 w-5 text-green-500 flex-shrink-0" />
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

function StatCard({
  icon,
  value,
  label,
}: {
  icon: React.ReactNode;
  value: number;
  label: string;
}) {
  return (
    <Card>
      <CardContent className="py-4 text-center">
        <div className="inline-flex items-center justify-center w-10 h-10 rounded-full bg-orange-100 text-orange-600 mb-2">
          {icon}
        </div>
        <p className="text-2xl font-bold text-gray-900">{value}</p>
        <p className="text-sm text-gray-500">{label}</p>
      </CardContent>
    </Card>
  );
}
