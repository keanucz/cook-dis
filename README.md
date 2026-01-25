# Cook-Dis 🍳

Transform any recipe into a guided, step-by-step cooking experience with AI-generated images and voice narration.

## ✨ Features

- **Recipe Import**: Paste any recipe URL with multi-fallback scraping (direct fetch → Firecrawl → Perplexity)
- **Recipe Search**: Search recipes from TheMealDB (free) or Spoonacular (API key required)
- **AI Step Images**: Beautiful AI-generated images for each cooking step using Runware's official SDK (FLUX.2 models)
- **Voice Narration**: On-demand text-to-speech using ElevenLabs with audio preloading
- **Cooking Mode**: Immersive full-screen experience with full-bleed images and overlaid instruction cards
- **Progress Tracking**: Pick up where you left off, track completed recipes
- **Recipe Library**: Save, organize, and manage your recipe collection
- **Celebration**: Confetti party when you complete a dish! 🎉

## 🛠 Tech Stack

- **Frontend**: Next.js 16+ (App Router), React 19, TypeScript, TailwindCSS 4
- **Auth & Database**: Supabase (Auth + Postgres with Row Level Security)
- **Image Generation**: Runware SDK (`@runware/sdk-js`) with FLUX.2 models
- **Text-to-Speech**: ElevenLabs API
- **LLM**: OpenAI GPT-4o (for recipe normalization and parsing)
- **Recipe Scraping**: Firecrawl + Perplexity AI as fallbacks for protected sites
- **Storage**: Pluggable backend (Local filesystem / Supabase Storage / S3-compatible)

## 📁 Project Structure

```
cook-dis/
├── src/
│   ├── app/                    # Next.js App Router pages
│   │   ├── api/               # API routes
│   │   │   ├── jobs/          # Background job worker + trigger
│   │   │   ├── media/         # Local file serving
│   │   │   ├── recipes/       # Recipe CRUD + import
│   │   │   ├── steps/         # Step media retry
│   │   │   ├── tts/           # On-demand text-to-speech
│   │   │   └── search/        # Recipe search API
│   │   ├── auth/              # Auth callback
│   │   ├── cook/[id]/         # Cooking mode (full-screen guided experience)
│   │   ├── import/            # Recipe import page
│   │   ├── library/           # Recipe library
│   │   ├── login/             # Authentication
│   │   ├── profile/           # User profile & settings
│   │   └── search/            # Recipe search
│   ├── components/            # React components
│   │   ├── layout/           # Navbar, etc.
│   │   └── ui/               # Button, Card, Input, Toaster, etc.
│   ├── lib/
│   │   ├── services/         # External API integrations
│   │   │   ├── elevenlabs.ts # TTS service
│   │   │   ├── openai.ts     # Recipe normalization
│   │   │   ├── recipe-parser.ts # Multi-fallback URL scraping
│   │   │   ├── recipe-search.ts # TheMealDB + Spoonacular
│   │   │   └── runware.ts    # Image generation (official SDK)
│   │   ├── storage/          # Media storage abstraction
│   │   │   ├── base.ts       # Abstract base class
│   │   │   ├── local.ts      # Local filesystem
│   │   │   ├── s3.ts         # S3-compatible (AWS/R2/MinIO)
│   │   │   ├── supabase.ts   # Supabase Storage
│   │   │   └── index.ts      # Factory function
│   │   └── supabase/         # Supabase client utilities
│   └── types/                # TypeScript types
├── supabase/
│   └── migrations/           # Database migrations
└── data/
    └── media/               # Local storage directory (gitignored)
```

## 🚀 Getting Started

### Prerequisites

- Node.js 18+
- npm
- Supabase account (free tier works)
- API keys for:
  - **OpenAI** (required - recipe normalization)
  - **Runware** (required - image generation)
  - **ElevenLabs** (required - voice narration)
  - **Firecrawl** (optional - enhanced recipe scraping)
  - **Perplexity** (optional - AI-powered scraping fallback)
  - **Spoonacular** (optional - recipe search)

### 1. Clone and Install

```bash
git clone https://github.com/keanucz/cook-dis.git
cd cook-dis
npm install
```

### 2. Set Up Supabase

1. Create a new Supabase project at [supabase.com](https://supabase.com)
2. Go to SQL Editor and run the migration file:
   - `supabase/migrations/001_initial_schema.sql`
3. Enable Email Auth in Authentication → Providers
4. (Optional) Enable Google OAuth for social login
5. If using Supabase Storage, create two private buckets:
   - `recipe-step-images`
   - `recipe-step-audio`

### 3. Configure Environment

Create `.env.local` with your values:

```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# Media Storage (choose: local, supabase, or s3)
MEDIA_STORAGE_BACKEND=local
LOCAL_STORAGE_PATH=./data/media

# OpenAI (required)
OPENAI_API_KEY=sk-...

# Runware (required)
RUNWARE_API_KEY=...

# ElevenLabs (required)
ELEVENLABS_API_KEY=...

# Firecrawl (optional - for protected recipe sites)
FIRECRAWL_API_KEY=...

# Perplexity (optional - AI scraping fallback)
PERPLEXITY_API_KEY=...

# Spoonacular (optional - recipe search)
SPOONACULAR_API_KEY=...

# Worker Auth
CRON_SECRET=your-random-secret

# App URL
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

### 4. Run Development Server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

## 🖼 Image Generation

Cook-Dis uses Runware's official SDK (`@runware/sdk-js`) for AI image generation:

- **WebSocket connection** with auto-reconnect for reliability
- **Consistent visual style** - all images use the same cookware (stainless steel pan, marble countertop) for continuity
- **Professional food photography** prompts optimized for appetizing results
- **Base64 output** for direct storage without additional downloads

### Available Models

| Model      | ID          | Description                        |
|------------|-------------|------------------------------------|
| FLUX.2 Dev | `flux2dev`  | Fast generation, great quality (default) |
| FLUX.2 Max | `flux_2_max`| Highest quality, slower            |

Model preference is set per-user in Profile settings and persisted with each recipe.

## 🎙 Voice Narration

Text-to-speech is generated **on-demand** when the user taps play:

1. First tap generates audio via ElevenLabs API
2. Audio is cached in browser memory
3. After all images complete, audio is **preloaded** for all steps in the background
4. Subsequent plays are instant

This approach minimizes API costs while providing a smooth experience.

## 📦 Media Storage Backends

### Local Filesystem (Default)

```env
MEDIA_STORAGE_BACKEND=local
LOCAL_STORAGE_PATH=./data/media
```

- Files stored in `./data/media/` directory
- Served via authenticated API route (`/api/media/[...path]`)
- Best for development and self-hosted deployments

### Supabase Storage

```env
MEDIA_STORAGE_BACKEND=supabase
```

- Create private buckets: `recipe-step-images`, `recipe-step-audio`
- Files served via signed URLs (1 hour expiry)

### S3-Compatible (AWS S3, Cloudflare R2, MinIO)

```env
MEDIA_STORAGE_BACKEND=s3
S3_ENDPOINT=https://your-account.r2.cloudflarestorage.com
S3_REGION=auto
S3_ACCESS_KEY_ID=...
S3_SECRET_ACCESS_KEY=...
S3_BUCKET=cook-dis-media
S3_PUBLIC_BASE_URL=https://media.yourdomain.com  # Optional CDN
```

## 🔄 Background Jobs

Media generation runs asynchronously via a Postgres-based job queue:

1. **Recipe Import** → Creates `generate_step_image` jobs for each step
2. **Cook Page** → Triggers worker automatically while waiting
3. **Worker** processes jobs with retry logic (up to 3 attempts)
4. **Failed media** can be manually retried from the cooking interface

### Development

The cook page automatically triggers the worker every 15 seconds while images are generating.

### Production (Vercel Cron)

```json
{
  "crons": [{
    "path": "/api/jobs/worker",
    "schedule": "* * * * *"
  }]
}
```

### Self-Hosted Cron

```bash
* * * * * curl -X POST https://your-domain.com/api/jobs/worker -H "Authorization: Bearer $CRON_SECRET"
```

## 🔒 Security

- All API keys are server-side only (never exposed to client)
- Row Level Security (RLS) on all Supabase tables
- Users can only access their own recipes and media
- Signed URLs for private media access
- CRON_SECRET protects the worker endpoint

## 📱 Recipe Import Sources

### URL Import (Multi-Fallback)

1. **Direct Fetch** - Standard HTTP request with cheerio parsing
2. **Firecrawl** - Handles Cloudflare, JavaScript rendering
3. **Perplexity AI** - Uses AI to extract recipe from any page

Supports most recipe websites via:

- Schema.org JSON-LD (preferred)
- Microdata markup
- OpenAI-powered content extraction

### Recipe Search

- **TheMealDB**: Free, no API key required
- **Spoonacular**: Requires API key, more comprehensive database

## 🚀 Deployment

### Vercel (Recommended)

1. Push to GitHub
2. Import project in Vercel
3. Add environment variables
4. Deploy!

Vercel automatically handles the cron job for background processing.

### Docker

```dockerfile
FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build
EXPOSE 3000
CMD ["npm", "start"]
```

```bash
docker build -t cook-dis .
docker run -p 3000:3000 --env-file .env.local cook-dis
```

## 🔑 Getting API Keys

| Service     | URL                                                      | Notes                              |
|-------------|----------------------------------------------------------|------------------------------------|
| OpenAI      | [platform.openai.com](https://platform.openai.com)       | Required - GPT-4o for recipe parsing |
| Runware     | [runware.ai](https://runware.ai)                         | Required - FLUX.2 image generation |
| ElevenLabs  | [elevenlabs.io](https://elevenlabs.io)                   | Required - Free tier available     |
| Firecrawl   | [firecrawl.dev](https://firecrawl.dev)                   | Optional - Enhanced scraping       |
| Perplexity  | [perplexity.ai](https://perplexity.ai)                   | Optional - AI fallback             |
| Spoonacular | [spoonacular.com/food-api](https://spoonacular.com/food-api) | Optional - Recipe search       |

## 🤝 Contributing

Contributions are welcome! Please open an issue or PR.

## 📄 License

MIT License - see [LICENSE](LICENSE)

---

Built with ❤️ for home cooks everywhere. Happy cooking! 🍳
