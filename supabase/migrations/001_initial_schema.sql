-- ===========================================
-- Cook-Dis Database Schema
-- Run this in your Supabase SQL Editor
-- ===========================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ===========================================
-- TABLES
-- ===========================================

-- User Settings
CREATE TABLE user_settings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  default_model_architecture TEXT NOT NULL DEFAULT 'flux2dev',
  default_model_air TEXT NOT NULL DEFAULT 'runware:400@1',
  autoplay_narration BOOLEAN NOT NULL DEFAULT true,
  muted_by_default BOOLEAN NOT NULL DEFAULT false,
  preferred_voice_id TEXT,
  recipe_search_provider TEXT NOT NULL DEFAULT 'themealdb',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id)
);

-- Recipes
CREATE TABLE recipes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  servings INTEGER,
  prep_time_minutes INTEGER,
  cook_time_minutes INTEGER,
  total_time_minutes INTEGER,
  source_url TEXT,
  source_type TEXT NOT NULL DEFAULT 'url',
  thumbnail_url TEXT,
  ingredients JSONB NOT NULL DEFAULT '[]'::jsonb,
  model_architecture TEXT NOT NULL DEFAULT 'flux2dev',
  model_air TEXT NOT NULL DEFAULT 'runware:400@1',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Recipe Steps
CREATE TABLE recipe_steps (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  recipe_id UUID NOT NULL REFERENCES recipes(id) ON DELETE CASCADE,
  step_index INTEGER NOT NULL,
  instruction TEXT NOT NULL,
  tips TEXT,
  timer_minutes INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(recipe_id, step_index)
);

-- Step Media (generated images and audio)
CREATE TABLE step_media (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  step_id UUID NOT NULL REFERENCES recipe_steps(id) ON DELETE CASCADE,
  recipe_id UUID NOT NULL REFERENCES recipes(id) ON DELETE CASCADE,
  image_path TEXT,
  audio_path TEXT,
  image_status TEXT NOT NULL DEFAULT 'pending',
  audio_status TEXT NOT NULL DEFAULT 'pending',
  image_error TEXT,
  audio_error TEXT,
  model_architecture TEXT,
  model_air TEXT,
  generation_prompt TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(step_id)
);

-- User Recipe Relationships
CREATE TABLE user_recipes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  recipe_id UUID NOT NULL REFERENCES recipes(id) ON DELETE CASCADE,
  is_saved BOOLEAN NOT NULL DEFAULT true,
  is_favorite BOOLEAN NOT NULL DEFAULT false,
  completed_at TIMESTAMPTZ,
  last_viewed_step INTEGER NOT NULL DEFAULT 0,
  progress INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, recipe_id)
);

-- Background Jobs Queue
CREATE TABLE jobs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  type TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  attempts INTEGER NOT NULL DEFAULT 0,
  max_attempts INTEGER NOT NULL DEFAULT 3,
  run_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_error TEXT,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ===========================================
-- INDEXES
-- ===========================================

CREATE INDEX idx_recipes_user_id ON recipes(user_id);
CREATE INDEX idx_recipe_steps_recipe_id ON recipe_steps(recipe_id);
CREATE INDEX idx_step_media_recipe_id ON step_media(recipe_id);
CREATE INDEX idx_step_media_step_id ON step_media(step_id);
CREATE INDEX idx_user_recipes_user_id ON user_recipes(user_id);
CREATE INDEX idx_user_recipes_recipe_id ON user_recipes(recipe_id);
CREATE INDEX idx_jobs_status_run_at ON jobs(status, run_at) WHERE status IN ('pending', 'processing');
CREATE INDEX idx_jobs_type ON jobs(type);

-- ===========================================
-- ROW LEVEL SECURITY POLICIES
-- ===========================================

-- Enable RLS on all tables
ALTER TABLE user_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE recipes ENABLE ROW LEVEL SECURITY;
ALTER TABLE recipe_steps ENABLE ROW LEVEL SECURITY;
ALTER TABLE step_media ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_recipes ENABLE ROW LEVEL SECURITY;
ALTER TABLE jobs ENABLE ROW LEVEL SECURITY;

-- User Settings: Users can only access their own settings
CREATE POLICY "Users can view own settings" ON user_settings
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own settings" ON user_settings
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own settings" ON user_settings
  FOR UPDATE USING (auth.uid() = user_id);

-- Recipes: Users can only access their own recipes
CREATE POLICY "Users can view own recipes" ON recipes
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own recipes" ON recipes
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own recipes" ON recipes
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own recipes" ON recipes
  FOR DELETE USING (auth.uid() = user_id);

-- Recipe Steps: Users can access steps of their own recipes
CREATE POLICY "Users can view steps of own recipes" ON recipe_steps
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM recipes 
      WHERE recipes.id = recipe_steps.recipe_id 
      AND recipes.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert steps for own recipes" ON recipe_steps
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM recipes 
      WHERE recipes.id = recipe_steps.recipe_id 
      AND recipes.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update steps of own recipes" ON recipe_steps
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM recipes 
      WHERE recipes.id = recipe_steps.recipe_id 
      AND recipes.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete steps of own recipes" ON recipe_steps
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM recipes 
      WHERE recipes.id = recipe_steps.recipe_id 
      AND recipes.user_id = auth.uid()
    )
  );

-- Step Media: Users can access media of their own recipes
CREATE POLICY "Users can view media of own recipes" ON step_media
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM recipes 
      WHERE recipes.id = step_media.recipe_id 
      AND recipes.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert media for own recipes" ON step_media
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM recipes 
      WHERE recipes.id = step_media.recipe_id 
      AND recipes.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update media of own recipes" ON step_media
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM recipes 
      WHERE recipes.id = step_media.recipe_id 
      AND recipes.user_id = auth.uid()
    )
  );

-- User Recipes: Users can only access their own relationships
CREATE POLICY "Users can view own user_recipes" ON user_recipes
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own user_recipes" ON user_recipes
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own user_recipes" ON user_recipes
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own user_recipes" ON user_recipes
  FOR DELETE USING (auth.uid() = user_id);

-- Jobs: Service role only (no public access)
-- Jobs are managed by the backend worker using service role key
CREATE POLICY "Service role can manage jobs" ON jobs
  FOR ALL USING (auth.jwt() ->> 'role' = 'service_role');

-- ===========================================
-- FUNCTIONS & TRIGGERS
-- ===========================================

-- Auto-update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_user_settings_updated_at
  BEFORE UPDATE ON user_settings
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_recipes_updated_at
  BEFORE UPDATE ON recipes
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_step_media_updated_at
  BEFORE UPDATE ON step_media
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_user_recipes_updated_at
  BEFORE UPDATE ON user_recipes
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_jobs_updated_at
  BEFORE UPDATE ON jobs
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Function to create default user settings on signup
CREATE OR REPLACE FUNCTION create_user_settings()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO user_settings (user_id)
  VALUES (NEW.id)
  ON CONFLICT (user_id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to auto-create settings on user signup
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION create_user_settings();

-- ===========================================
-- HELPER FUNCTIONS FOR JOBS
-- ===========================================

-- Claim a pending job for processing
CREATE OR REPLACE FUNCTION claim_next_job(job_types TEXT[])
RETURNS jobs AS $$
DECLARE
  claimed_job jobs;
BEGIN
  UPDATE jobs
  SET 
    status = 'processing',
    attempts = attempts + 1,
    updated_at = NOW()
  WHERE id = (
    SELECT id FROM jobs
    WHERE status = 'pending'
    AND type = ANY(job_types)
    AND run_at <= NOW()
    AND attempts < max_attempts
    ORDER BY run_at ASC
    LIMIT 1
    FOR UPDATE SKIP LOCKED
  )
  RETURNING * INTO claimed_job;
  
  RETURN claimed_job;
END;
$$ LANGUAGE plpgsql;

-- Mark job as completed
CREATE OR REPLACE FUNCTION complete_job(job_id UUID)
RETURNS VOID AS $$
BEGIN
  UPDATE jobs
  SET 
    status = 'completed',
    completed_at = NOW()
  WHERE id = job_id;
END;
$$ LANGUAGE plpgsql;

-- Mark job as failed with retry scheduling
CREATE OR REPLACE FUNCTION fail_job(job_id UUID, error_message TEXT)
RETURNS VOID AS $$
DECLARE
  job_record jobs;
BEGIN
  SELECT * INTO job_record FROM jobs WHERE id = job_id;
  
  IF job_record.attempts >= job_record.max_attempts THEN
    UPDATE jobs
    SET 
      status = 'failed',
      last_error = error_message
    WHERE id = job_id;
  ELSE
    -- Exponential backoff: 2^attempts minutes
    UPDATE jobs
    SET 
      status = 'pending',
      last_error = error_message,
      run_at = NOW() + (POWER(2, job_record.attempts) * INTERVAL '1 minute')
    WHERE id = job_id;
  END IF;
END;
$$ LANGUAGE plpgsql;
