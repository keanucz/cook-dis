# Cook-Dis 🍳

Transform any recipe into a guided, step-by-step cooking experience with AI-generated images and voice narration.

## ✨ Features

- **Recipe Import**: Paste any recipe URL or search from TheMealDB/Spoonacular
- **AI Step Images**: Generated images for each cooking step using Runware (FLUX.2 models)
- **Voice Narration**: Natural text-to-speech using ElevenLabs
- **Cooking Mode**: Full-screen guided experience with Back/Next navigation
- **Progress Tracking**: Pick up where you left off
- **Recipe Library**: Save, favorite, and track completed recipes
- **Celebration**: Confetti party when you complete a dish! 🎉

## 🛠 Tech Stack

- **Frontend**: Next.js 14+ (App Router), TypeScript, TailwindCSS
- **Auth & Database**: Supabase (Auth + Postgres + RLS)
- **Image Generation**: Runware (FLUX.2 Max / FLUX.2 Dev)
- **Text-to-Speech**: ElevenLabs
- **LLM**: OpenAI GPT-5.2 (for recipe normalization)
- **Storage**: Pluggable backend (Supabase Storage / Local / S3-compatible)

## 📁 Project Structure

```
cook-dis/
├── src/
│   ├── app/                    # Next.js App Router pages
│   │   ├── api/               # API routes
│   │   │   ├── jobs/          # Background job worker
│   │   │   ├── media/         # Local file serving
│   │   │   ├── recipes/       # Recipe CRUD + import
│   │   │   └── steps/         # Step media retry
│   │   ├── auth/              # Auth callback
│   │   ├── cook/[id]/         # Cooking mode
│   │   ├── import/            # Recipe import
│   │   ├── library/           # Recipe library
│   │   ├── login/             # Authentication
│   │   ├── profile/           # User profile & settings
│   │   └── search/            # Recipe search
│   ├── components/            # React components
│   │   ├── layout/           # Navbar, etc.
│   │   └── ui/               # Button, Card, Input, etc.
│   ├── lib/
│   │   ├── services/         # External API integrations
│   │   │   ├── elevenlabs.ts
│   │   │   ├── openai.ts
│   │   │   ├── recipe-parser.ts
│   │   │   ├── recipe-search.ts
│   │   │   └── runware.ts
│   │   ├── storage/          # Media storage abstraction
│   │   │   ├── base.ts
│   │   │   ├── local.ts
│   │   │   ├── s3.ts
│   │   │   ├── supabase.ts
│   │   │   └── index.ts
│   │   └── supabase/         # Supabase clients
│   └── types/                # TypeScript types
├── supabase/
│   └── migrations/           # Database migrations
└── data/
    └── media/               # Local storage (gitignored)
```

## 🚀 Getting Started

### Prerequisites

- Node.js 18+
- npm or pnpm
- Supabase account (free tier works)
- API keys for:
  - OpenAI (GPT-5.2)
  - Runware (image generation)
  - ElevenLabs (text-to-speech)
  - (Optional) Spoonacular (recipe search)

### 1. Clone and Install

```bash
git clone https://github.com/yourusername/cook-dis.git
cd cook-dis
npm install --legacy-peer-deps
```

### 2. Set Up Supabase

1. Create a new Supabase project at [supabase.com](https://supabase.com)
2. Go to SQL Editor and run the migration file:
   - `supabase/migrations/001_initial_schema.sql`
3. Enable Email Auth in Authentication > Providers
4. (Optional) Enable Google OAuth
5. Create storage buckets (if using Supabase Storage):
   - `recipe-step-images` (private)
   - `recipe-step-audio` (private)

### 3. Configure Environment

Copy the example env file and fill in your values:

```bash
cp .env.example .env.local
```

Required variables:

```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# Media Storage (choose one: local, supabase, or s3)
MEDIA_STORAGE_BACKEND=local

# OpenAI
OPENAI_API_KEY=sk-...

# Runware
RUNWARE_API_KEY=...

# ElevenLabs
ELEVENLABS_API_KEY=...

# Cron Secret (for job worker)
CRON_SECRET=your-random-secret

# App URL
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

### 4. Run Development Server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

### 5. Start Background Worker

The worker processes image and audio generation jobs. In development, trigger it manually:

```bash
curl -X POST http://localhost:3000/api/jobs/worker \
  -H "Authorization: Bearer your-cron-secret"
```

Or use a cron job to run every minute.

## 📦 Media Storage Backends

Cook-Dis supports three interchangeable storage backends for generated images and audio:

### Local Filesystem (Development/Self-Host)

```env
MEDIA_STORAGE_BACKEND=local
LOCAL_STORAGE_PATH=./data/media
```

- Files stored in `./data/media/` directory
- Served via secure API route (`/api/media/[path]`)
- Best for development and self-hosted deployments

### Supabase Storage

```env
MEDIA_STORAGE_BACKEND=supabase
```

Create two private buckets in Supabase:
- `recipe-step-images`
- `recipe-step-audio`

Files are served via signed URLs (1 hour expiry).

### S3-Compatible (AWS S3, Cloudflare R2, MinIO)

```env
MEDIA_STORAGE_BACKEND=s3
S3_ENDPOINT=https://your-account.r2.cloudflarestorage.com
S3_REGION=auto
S3_ACCESS_KEY_ID=your-access-key
S3_SECRET_ACCESS_KEY=your-secret-key
S3_BUCKET=cook-dis-media
S3_PUBLIC_BASE_URL=https://media.yourdomain.com  # Optional: for public CDN
```

For Cloudflare R2:
1. Create an R2 bucket in Cloudflare dashboard
2. Create API tokens with read/write permissions
3. Set the endpoint to your R2 endpoint

## 🤖 AI Model Selection

Users can choose between two Runware models for step images:

| Model | ID | Description |
|-------|-----|-------------|
| FLUX.2 Max | `flux_2_max` | Highest quality, slower |
| FLUX.2 Dev | `flux2dev` | Fast, great quality (default) |

Model preference can be set:
1. **Globally**: In user settings (Profile page)
2. **Per-recipe**: At import time

The chosen model is persisted with the recipe for consistent regeneration.

## 🔄 Background Jobs

Media generation runs in the background using a Postgres-based job queue:

1. When a recipe is imported, jobs are created for each step (image + audio)
2. A worker endpoint (`/api/jobs/worker`) processes pending jobs
3. Jobs support retry with exponential backoff (up to 3 attempts)
4. Users can manually retry failed media from the cooking interface

### Vercel Cron (Production)

The included `vercel.json` configures automatic job processing:

```json
{
  "crons": [
    {
      "path": "/api/jobs/worker",
      "schedule": "* * * * *"
    }
  ]
}
```

### Manual Cron (Self-Hosted)

```bash
# Run every minute
* * * * * curl -X POST https://your-domain.com/api/jobs/worker -H "Authorization: Bearer $CRON_SECRET"
```

## 🔒 Security

- All API keys are server-side only
- Row Level Security (RLS) on all Supabase tables
- Users can only access their own recipes and media
- Signed URLs for private media access
- CRON_SECRET protects the worker endpoint

## 📱 Recipe Sources

### URL Import
Supports most recipe websites with:
- Schema.org JSON-LD (preferred)
- Microdata markup
- LLM fallback for unstructured pages

### Recipe Search
- **TheMealDB**: Free, no API key required
- **Spoonacular**: Requires API key, more comprehensive

## 🚀 Deployment

### Vercel (Recommended)

1. Push to GitHub
2. Import project in Vercel
3. Add environment variables
4. Deploy!

Vercel will automatically:
- Build the Next.js app
- Run the cron job every minute

### Docker (Self-Hosted)

```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --legacy-peer-deps
COPY . .
RUN npm run build
CMD ["npm", "start"]
```

```bash
docker build -t cook-dis .
docker run -p 3000:3000 --env-file .env.local cook-dis
```

## 🔑 Getting API Keys

### OpenAI
1. Go to [platform.openai.com](https://platform.openai.com)
2. Create account and add payment method
3. Generate API key in API Keys section

### Runware
1. Visit [runware.ai](https://runware.ai)
2. Sign up for an account
3. Get API key from dashboard

### ElevenLabs
1. Go to [elevenlabs.io](https://elevenlabs.io)
2. Create account (free tier available)
3. Get API key from profile settings

### Spoonacular (Optional)
1. Visit [spoonacular.com/food-api](https://spoonacular.com/food-api)
2. Sign up for free account
3. Get API key from dashboard

## 🤝 Contributing

Contributions are welcome! Please open an issue or PR.

## 📄 License

MIT License - see [LICENSE](LICENSE)

---

Built with ❤️ for home cooks everywhere. Happy cooking! 🍳
