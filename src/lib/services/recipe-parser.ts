// ===========================================
// Recipe URL Parser
// With Firecrawl and Perplexity fallbacks
// ===========================================

import * as cheerio from 'cheerio';
import { ParsedRecipe, Ingredient } from '@/types';
import { getOpenAIService } from './openai';
import FirecrawlApp from '@mendable/firecrawl-js';

type ScrapingMethod = 'direct' | 'firecrawl' | 'perplexity';

export class RecipeUrlParser {
  private firecrawl: FirecrawlApp | null = null;

  constructor() {
    // Initialize Firecrawl if API key is available
    if (process.env.FIRECRAWL_API_KEY) {
      this.firecrawl = new FirecrawlApp({ apiKey: process.env.FIRECRAWL_API_KEY });
    }
  }

  async parseUrl(url: string): Promise<ParsedRecipe> {
    const methods: ScrapingMethod[] = ['direct', 'perplexity', 'firecrawl'];
    let lastError: Error | null = null;

    for (const method of methods) {
      try {
        console.log(`Trying to fetch recipe with method: ${method}`);
        const result = await this.fetchWithMethod(url, method);
        if (result) {
          console.log(`Successfully fetched recipe using: ${method}`);
          return result;
        }
      } catch (error) {
        console.error(`Method ${method} failed:`, error);
        lastError = error as Error;
        // Continue to next method
      }
    }

    throw lastError || new Error('All scraping methods failed');
  }

  private async fetchWithMethod(url: string, method: ScrapingMethod): Promise<ParsedRecipe | null> {
    switch (method) {
      case 'direct':
        return this.fetchDirect(url);
      case 'firecrawl':
        return this.fetchWithFirecrawl(url);
      case 'perplexity':
        return this.fetchWithPerplexity(url);
      default:
        return null;
    }
  }

  // Direct fetch with browser headers
  private async fetchDirect(url: string): Promise<ParsedRecipe> {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64; rv:146.0) Gecko/20100101 Firefox/146.0',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
        'Accept-Encoding': 'gzip, deflate, br',
        'DNT': '1',
        'Connection': 'keep-alive',
        'Upgrade-Insecure-Requests': '1',
        'Sec-Fetch-Dest': 'document',
        'Sec-Fetch-Mode': 'navigate',
        'Sec-Fetch-Site': 'none',
        'Sec-Fetch-User': '?1',
        'Cache-Control': 'max-age=0',
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch URL: ${response.status}`);
    }

    const html = await response.text();
    return this.parseHtml(html, url);
  }

  // Firecrawl - handles Cloudflare and JS rendering
  private async fetchWithFirecrawl(url: string): Promise<ParsedRecipe> {
    if (!this.firecrawl) {
      throw new Error('Firecrawl API key not configured');
    }

    const result = await this.firecrawl.scrapeUrl(url, {
      formats: ['html', 'markdown'],
    });

    if (!result.success) {
      throw new Error(`Firecrawl failed: ${result.error || 'Unknown error'}`);
    }

    // Try to parse HTML first for structured data
    if (result.html) {
      try {
        return this.parseHtml(result.html, url);
      } catch {
        // Fall through to markdown parsing
      }
    }

    // Use markdown content with LLM
    if (result.markdown) {
      const openai = getOpenAIService();
      return openai.normalizeRecipe(result.markdown, url);
    }

    throw new Error('Firecrawl returned no usable content');
  }

  // Perplexity - uses AI to extract recipe information
  private async fetchWithPerplexity(url: string): Promise<ParsedRecipe> {
    const apiKey = process.env.PERPLEXITY_API_KEY;
    if (!apiKey) {
      throw new Error('Perplexity API key not configured');
    }

    const response = await fetch('https://api.perplexity.ai/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'sonar',
        messages: [
          {
            role: 'system',
            content: `You are a recipe extraction assistant. Extract recipe information from the given URL and return it as valid JSON with this exact structure:
{
  "title": "Recipe name",
  "description": "Brief description",
  "servings": 4,
  "prepTimeMinutes": 15,
  "cookTimeMinutes": 30,
  "ingredients": [{"name": "ingredient name", "amount": "1", "unit": "cup"}],
  "steps": ["Step 1 instruction", "Step 2 instruction"],
  "thumbnailUrl": "image url if available"
}
Return ONLY the JSON, no other text.`,
          },
          {
            role: 'user',
            content: `Extract the complete recipe from this URL: ${url}`,
          },
        ],
        temperature: 0.1,
        max_tokens: 4000,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Perplexity API error: ${response.status} - ${error}`);
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;

    if (!content) {
      throw new Error('Perplexity returned no content');
    }

    // Parse the JSON response
    try {
      // Extract JSON from the response (it might be wrapped in markdown code blocks)
      const jsonMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/) || [null, content];
      const jsonStr = jsonMatch[1].trim();
      const parsed = JSON.parse(jsonStr);

      return {
        title: parsed.title || 'Untitled Recipe',
        description: parsed.description,
        servings: parsed.servings,
        prepTimeMinutes: parsed.prepTimeMinutes,
        cookTimeMinutes: parsed.cookTimeMinutes,
        ingredients: (parsed.ingredients || []).map((ing: { name: string; amount?: string; unit?: string }) => ({
          name: ing.name,
          amount: ing.amount,
          unit: ing.unit,
        })),
        steps: parsed.steps || [],
        thumbnailUrl: parsed.thumbnailUrl,
        sourceUrl: url,
      };
    } catch (parseError) {
      throw new Error(`Failed to parse Perplexity response: ${parseError}`);
    }
  }

  // Parse HTML content
  private parseHtml(html: string, url: string): ParsedRecipe {
    const $ = cheerio.load(html);

    // Try to find JSON-LD schema.org Recipe data first
    const jsonLdRecipe = this.extractJsonLd($);
    if (jsonLdRecipe) {
      return this.parseJsonLdRecipe(jsonLdRecipe, url);
    }

    // Try microdata format
    const microdataRecipe = this.extractMicrodata($);
    if (microdataRecipe) {
      return microdataRecipe;
    }

    // Fallback: Use LLM to parse the raw content
    const rawContent = this.extractRawContent($, url);
    const openai = getOpenAIService();
    return openai.normalizeRecipe(rawContent, url);
  }

  private extractJsonLd($: cheerio.CheerioAPI): JsonLdRecipe | null {
    const scripts = $('script[type="application/ld+json"]');
    
    for (let i = 0; i < scripts.length; i++) {
      try {
        const content = $(scripts[i]).html();
        if (!content) continue;

        const data = JSON.parse(content);
        
        // Handle @graph format
        if (data['@graph']) {
          for (const item of data['@graph']) {
            if (item['@type'] === 'Recipe' || 
                (Array.isArray(item['@type']) && item['@type'].includes('Recipe'))) {
              return item as JsonLdRecipe;
            }
          }
        }

        // Direct Recipe type
        if (data['@type'] === 'Recipe' || 
            (Array.isArray(data['@type']) && data['@type'].includes('Recipe'))) {
          return data as JsonLdRecipe;
        }
      } catch {
        // Continue to next script
      }
    }

    return null;
  }

  private parseJsonLdRecipe(data: JsonLdRecipe, sourceUrl: string): ParsedRecipe {
    // Parse ingredients
    const ingredients: Ingredient[] = [];
    const rawIngredients = data.recipeIngredient || data.ingredients || [];
    
    for (const ing of rawIngredients) {
      if (typeof ing === 'string') {
        ingredients.push(this.parseIngredientString(ing));
      }
    }

    // Parse instructions
    let steps: string[] = [];
    const instructions = data.recipeInstructions || [];
    
    if (typeof instructions === 'string') {
      steps = instructions.split(/(?:\r?\n)+/).filter(s => s.trim());
    } else if (Array.isArray(instructions)) {
      for (const inst of instructions) {
        if (typeof inst === 'string') {
          steps.push(inst);
        } else if (inst['@type'] === 'HowToStep') {
          steps.push(inst.text || inst.name || '');
        } else if (inst['@type'] === 'HowToSection') {
          // Handle sectioned instructions
          const sectionSteps = inst.itemListElement || [];
          for (const step of sectionSteps) {
            if (typeof step === 'string') {
              steps.push(step);
            } else if (step.text) {
              steps.push(step.text);
            }
          }
        }
      }
    }

    // Parse times
    const prepTime = this.parseIsoDuration(data.prepTime);
    const cookTime = this.parseIsoDuration(data.cookTime);
    const totalTime = this.parseIsoDuration(data.totalTime);

    // Parse image
    let thumbnailUrl: string | undefined;
    if (typeof data.image === 'string') {
      thumbnailUrl = data.image;
    } else if (Array.isArray(data.image)) {
      thumbnailUrl = typeof data.image[0] === 'string' ? data.image[0] : data.image[0]?.url;
    } else if (data.image?.url) {
      thumbnailUrl = data.image.url;
    }

    return {
      title: data.name || 'Untitled Recipe',
      description: data.description,
      servings: typeof data.recipeYield === 'number' 
        ? data.recipeYield 
        : this.parseServings(data.recipeYield),
      prepTimeMinutes: prepTime,
      cookTimeMinutes: cookTime,
      ingredients,
      steps: steps.filter(s => s.trim().length > 0),
      thumbnailUrl,
      sourceUrl,
    };
  }

  private parseIngredientString(str: string): Ingredient {
    // Simple parsing: try to extract amount and unit from the beginning
    const match = str.match(/^([\d./\s]+)?\s*(cups?|tbsps?|tsps?|tablespoons?|teaspoons?|oz|ounces?|lbs?|pounds?|g|grams?|kg|ml|liters?|pinch|dash)?\s*(.+)/i);
    
    if (match) {
      return {
        name: match[3]?.trim() || str,
        amount: match[1]?.trim(),
        unit: match[2]?.trim(),
      };
    }

    return { name: str };
  }

  private parseIsoDuration(duration?: string): number | undefined {
    if (!duration) return undefined;

    // Parse ISO 8601 duration (PT1H30M)
    const match = duration.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/i);
    if (match) {
      const hours = parseInt(match[1] || '0', 10);
      const minutes = parseInt(match[2] || '0', 10);
      return hours * 60 + minutes;
    }

    // Try parsing plain number
    const numMatch = duration.match(/(\d+)/);
    if (numMatch) {
      return parseInt(numMatch[1], 10);
    }

    return undefined;
  }

  private parseServings(value?: string | number | string[]): number | undefined {
    if (typeof value === 'number') return value;
    if (!value) return undefined;

    const str = Array.isArray(value) ? value[0] : value;
    const match = str.match(/(\d+)/);
    return match ? parseInt(match[1], 10) : undefined;
  }

  private extractMicrodata($: cheerio.CheerioAPI): ParsedRecipe | null {
    const recipeEl = $('[itemtype*="schema.org/Recipe"]');
    if (recipeEl.length === 0) return null;

    const title = recipeEl.find('[itemprop="name"]').first().text().trim();
    if (!title) return null;

    const ingredients: Ingredient[] = [];
    recipeEl.find('[itemprop="recipeIngredient"], [itemprop="ingredients"]').each((_, el) => {
      const text = $(el).text().trim();
      if (text) {
        ingredients.push(this.parseIngredientString(text));
      }
    });

    const steps: string[] = [];
    recipeEl.find('[itemprop="recipeInstructions"]').each((_, el) => {
      const text = $(el).text().trim();
      if (text) {
        steps.push(text);
      }
    });

    if (steps.length === 0) return null;

    return {
      title,
      description: recipeEl.find('[itemprop="description"]').first().text().trim() || undefined,
      ingredients,
      steps,
    };
  }

  private extractRawContent($: cheerio.CheerioAPI, url: string): string {
    // Remove scripts, styles, nav, footer, ads
    $('script, style, nav, footer, header, aside, .ad, .advertisement, #comments').remove();

    // Get the main content area
    const mainContent = $('main, article, .recipe, .recipe-content, [role="main"]').first();
    const content = mainContent.length ? mainContent.text() : $('body').text();

    // Clean up whitespace
    const cleaned = content
      .replace(/\s+/g, ' ')
      .trim()
      .substring(0, 10000); // Limit to 10k chars for LLM

    return `URL: ${url}\n\n${cleaned}`;
  }
}

interface JsonLdRecipe {
  '@type': string | string[];
  name?: string;
  description?: string;
  recipeIngredient?: string[];
  ingredients?: string[];
  recipeInstructions?: string | JsonLdInstruction[];
  prepTime?: string;
  cookTime?: string;
  totalTime?: string;
  recipeYield?: string | number | string[];
  image?: string | string[] | { url: string };
}

interface JsonLdInstruction {
  '@type': string;
  text?: string;
  name?: string;
  itemListElement?: JsonLdInstruction[];
}

// Singleton
let parserInstance: RecipeUrlParser | null = null;

export function getRecipeUrlParser(): RecipeUrlParser {
  if (!parserInstance) {
    parserInstance = new RecipeUrlParser();
  }
  return parserInstance;
}
