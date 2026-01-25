// ===========================================
// OpenAI Service (GPT-5.2 for Recipe Normalization)
// ===========================================

import OpenAI from 'openai';
import { ParsedRecipe, Ingredient } from '@/types';

export class OpenAIService {
  private client: OpenAI;

  constructor() {
    this.client = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });
  }

  async normalizeRecipe(rawContent: string, sourceUrl?: string): Promise<ParsedRecipe> {
    const systemPrompt = `You are a recipe parsing expert. Extract and normalize recipe data from raw content into a structured JSON format.

Rules:
- Extract the recipe title, description, servings, prep time, and cook time
- Parse ingredients into structured format with name, amount, unit, and notes
- Break down instructions into clear, numbered steps (one action per step when possible)
- Ensure all measurements are consistent
- If information is missing, omit that field (don't guess)
- Return ONLY valid JSON, no markdown or explanation`;

    const userPrompt = `Parse this recipe content into JSON format:

${rawContent}

${sourceUrl ? `Source URL: ${sourceUrl}` : ''}

Return JSON with this structure:
{
  "title": "Recipe Title",
  "description": "Brief description",
  "servings": 4,
  "prepTimeMinutes": 15,
  "cookTimeMinutes": 30,
  "ingredients": [
    {"name": "flour", "amount": "2", "unit": "cups", "notes": "all-purpose"}
  ],
  "steps": [
    "Preheat oven to 350°F.",
    "Mix dry ingredients in a large bowl."
  ],
  "thumbnailUrl": "url if found"
}`;

    const response = await this.client.chat.completions.create({
      model: 'gpt-5.2',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      response_format: { type: 'json_object' },
      temperature: 0.3,
      max_tokens: 4000,
    });

    const content = response.choices[0]?.message?.content;
    if (!content) {
      throw new Error('No response from OpenAI');
    }

    try {
      const parsed = JSON.parse(content);
      return this.validateParsedRecipe(parsed);
    } catch (error) {
      throw new Error(`Failed to parse OpenAI response: ${error}`);
    }
  }

  private validateParsedRecipe(data: Record<string, unknown>): ParsedRecipe {
    if (!data.title || typeof data.title !== 'string') {
      throw new Error('Recipe must have a title');
    }

    if (!Array.isArray(data.steps) || data.steps.length === 0) {
      throw new Error('Recipe must have at least one step');
    }

    const ingredients: Ingredient[] = [];
    if (Array.isArray(data.ingredients)) {
      for (const ing of data.ingredients) {
        if (typeof ing === 'object' && ing !== null && 'name' in ing) {
          ingredients.push({
            name: String(ing.name),
            amount: ing.amount ? String(ing.amount) : undefined,
            unit: ing.unit ? String(ing.unit) : undefined,
            notes: ing.notes ? String(ing.notes) : undefined,
          });
        }
      }
    }

    return {
      title: data.title,
      description: typeof data.description === 'string' ? data.description : undefined,
      servings: typeof data.servings === 'number' ? data.servings : undefined,
      prepTimeMinutes: typeof data.prepTimeMinutes === 'number' ? data.prepTimeMinutes : undefined,
      cookTimeMinutes: typeof data.cookTimeMinutes === 'number' ? data.cookTimeMinutes : undefined,
      ingredients,
      steps: data.steps.map((s: unknown) => String(s)),
      thumbnailUrl: typeof data.thumbnailUrl === 'string' ? data.thumbnailUrl : undefined,
    };
  }

  async generateImagePrompt(
    stepInstruction: string,
    recipeTitle: string,
    stepIndex: number
  ): Promise<string> {
    const response = await this.client.chat.completions.create({
      model: 'gpt-5.2',
      messages: [
        {
          role: 'system',
          content: `You create short, vivid image prompts for AI image generation. Focus on:
- Food photography style
- Warm, appetizing lighting
- Clean, professional kitchen setting
- The specific cooking action or food state
Keep prompts under 100 words.`,
        },
        {
          role: 'user',
          content: `Create an image prompt for step ${stepIndex + 1} of "${recipeTitle}":
"${stepInstruction}"`,
        },
      ],
      temperature: 0.7,
      max_tokens: 150,
    });

    return response.choices[0]?.message?.content || stepInstruction;
  }
}

// Singleton instance
let openaiInstance: OpenAIService | null = null;

export function getOpenAIService(): OpenAIService {
  if (!openaiInstance) {
    openaiInstance = new OpenAIService();
  }
  return openaiInstance;
}
