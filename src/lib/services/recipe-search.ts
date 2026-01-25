// ===========================================
// Recipe Search Providers
// ===========================================

import { RecipeSearchResult, ParsedRecipe, Ingredient } from '@/types';

// ----- Base Provider Interface -----
export interface RecipeSearchProvider {
  search(query: string): Promise<RecipeSearchResult[]>;
  getRecipeById(id: string): Promise<ParsedRecipe>;
}

// ----- TheMealDB Provider (Free, no API key needed) -----
export class TheMealDBProvider implements RecipeSearchProvider {
  private baseUrl = 'https://www.themealdb.com/api/json/v1/1';

  async search(query: string): Promise<RecipeSearchResult[]> {
    const response = await fetch(
      `${this.baseUrl}/search.php?s=${encodeURIComponent(query)}`
    );

    if (!response.ok) {
      throw new Error('Failed to search TheMealDB');
    }

    const data = await response.json();
    const meals = data.meals || [];

    return meals.map((meal: TheMealDBMeal) => ({
      id: meal.idMeal,
      title: meal.strMeal,
      image: meal.strMealThumb,
      source: meal.strSource || 'TheMealDB',
      sourceUrl: meal.strSource,
      provider: 'themealdb' as const,
    }));
  }

  async getRecipeById(id: string): Promise<ParsedRecipe> {
    const response = await fetch(`${this.baseUrl}/lookup.php?i=${id}`);

    if (!response.ok) {
      throw new Error('Failed to fetch recipe from TheMealDB');
    }

    const data = await response.json();
    const meal = data.meals?.[0];

    if (!meal) {
      throw new Error('Recipe not found');
    }

    return this.parseMeal(meal);
  }

  private parseMeal(meal: TheMealDBMeal): ParsedRecipe {
    // Extract ingredients (TheMealDB has strIngredient1-20 and strMeasure1-20)
    const ingredients: Ingredient[] = [];
    for (let i = 1; i <= 20; i++) {
      const name = meal[`strIngredient${i}` as keyof TheMealDBMeal];
      const measure = meal[`strMeasure${i}` as keyof TheMealDBMeal];

      if (name && typeof name === 'string' && name.trim()) {
        ingredients.push({
          name: name.trim(),
          amount: measure && typeof measure === 'string' ? measure.trim() : undefined,
        });
      }
    }

    // Parse instructions into steps
    const instructionText = meal.strInstructions || '';
    const steps = this.parseInstructions(instructionText);

    return {
      title: meal.strMeal,
      description: `${meal.strCategory} - ${meal.strArea}`,
      ingredients,
      steps,
      thumbnailUrl: meal.strMealThumb,
      sourceUrl: meal.strSource,
    };
  }

  private parseInstructions(text: string): string[] {
    // Split by common step patterns
    const steps = text
      .split(/(?:\r?\n)+|(?:STEP\s*\d+[:.]\s*)|(?:\d+[.)]\s+)/)
      .map(s => s.trim())
      .filter(s => s.length > 10); // Filter out very short fragments

    if (steps.length === 0) {
      // Fallback: split by sentences
      return text
        .split(/(?<=[.!?])\s+/)
        .filter(s => s.trim().length > 10);
    }

    return steps;
  }
}

interface TheMealDBMeal {
  idMeal: string;
  strMeal: string;
  strCategory: string;
  strArea: string;
  strInstructions: string;
  strMealThumb: string;
  strSource?: string;
  [key: string]: string | undefined;
}

// ----- Spoonacular Provider -----
export class SpoonacularProvider implements RecipeSearchProvider {
  private apiKey: string;
  private baseUrl = 'https://api.spoonacular.com';

  constructor() {
    this.apiKey = process.env.SPOONACULAR_API_KEY || '';
    if (!this.apiKey) {
      console.warn('SPOONACULAR_API_KEY not configured');
    }
  }

  async search(query: string): Promise<RecipeSearchResult[]> {
    if (!this.apiKey) {
      throw new Error('Spoonacular API key not configured');
    }

    const response = await fetch(
      `${this.baseUrl}/recipes/complexSearch?query=${encodeURIComponent(query)}&number=20&apiKey=${this.apiKey}`
    );

    if (!response.ok) {
      throw new Error('Failed to search Spoonacular');
    }

    const data = await response.json();
    const results = data.results || [];

    return results.map((recipe: SpoonacularSearchResult) => ({
      id: String(recipe.id),
      title: recipe.title,
      image: recipe.image,
      source: 'Spoonacular',
      provider: 'spoonacular' as const,
    }));
  }

  async getRecipeById(id: string): Promise<ParsedRecipe> {
    if (!this.apiKey) {
      throw new Error('Spoonacular API key not configured');
    }

    const response = await fetch(
      `${this.baseUrl}/recipes/${id}/information?includeNutrition=false&apiKey=${this.apiKey}`
    );

    if (!response.ok) {
      throw new Error('Failed to fetch recipe from Spoonacular');
    }

    const recipe = await response.json() as SpoonacularRecipe;

    return this.parseRecipe(recipe);
  }

  private parseRecipe(recipe: SpoonacularRecipe): ParsedRecipe {
    const ingredients: Ingredient[] = recipe.extendedIngredients?.map(ing => ({
      name: ing.name || ing.originalName,
      amount: ing.amount ? String(ing.amount) : undefined,
      unit: ing.unit,
      notes: ing.meta?.join(', '),
    })) || [];

    // Parse instructions from analyzedInstructions
    let steps: string[] = [];
    if (recipe.analyzedInstructions?.[0]?.steps) {
      steps = recipe.analyzedInstructions[0].steps.map(s => s.step);
    } else if (recipe.instructions) {
      // Fallback to plain text instructions
      steps = recipe.instructions
        .split(/(?:\r?\n)+|(?:\d+[.)]\s+)/)
        .filter(s => s.trim().length > 10);
    }

    return {
      title: recipe.title,
      description: recipe.summary?.replace(/<[^>]+>/g, '').substring(0, 200),
      servings: recipe.servings,
      prepTimeMinutes: recipe.preparationMinutes,
      cookTimeMinutes: recipe.cookingMinutes,
      ingredients,
      steps,
      thumbnailUrl: recipe.image,
      sourceUrl: recipe.sourceUrl,
    };
  }
}

interface SpoonacularSearchResult {
  id: number;
  title: string;
  image: string;
}

interface SpoonacularRecipe {
  id: number;
  title: string;
  image: string;
  summary: string;
  servings: number;
  preparationMinutes: number;
  cookingMinutes: number;
  readyInMinutes: number;
  sourceUrl: string;
  instructions: string;
  extendedIngredients: SpoonacularIngredient[];
  analyzedInstructions: {
    steps: { number: number; step: string }[];
  }[];
}

interface SpoonacularIngredient {
  name: string;
  originalName: string;
  amount: number;
  unit: string;
  meta: string[];
}

// ----- Factory -----
export type RecipeSearchProviderType = 'spoonacular' | 'themealdb';

export function getRecipeSearchProvider(
  type?: RecipeSearchProviderType
): RecipeSearchProvider {
  const providerType = type || 
    (process.env.RECIPE_SEARCH_PROVIDER as RecipeSearchProviderType) || 
    'themealdb';

  switch (providerType) {
    case 'spoonacular':
      return new SpoonacularProvider();
    case 'themealdb':
    default:
      return new TheMealDBProvider();
  }
}
