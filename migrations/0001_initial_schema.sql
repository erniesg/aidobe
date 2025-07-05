-- Initial schema for aidobe database
-- Creates all necessary tables for the application

-- Prompts table - stores user prompts and generation requests
CREATE TABLE IF NOT EXISTS prompts (
  id TEXT PRIMARY KEY,
  original_prompt TEXT NOT NULL,
  enhanced_prompt TEXT,
  model TEXT NOT NULL,
  parameters TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  error_message TEXT,
  user_agent TEXT,
  ip_address TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Outputs table - stores generated image/video outputs
CREATE TABLE IF NOT EXISTS outputs (
  id TEXT PRIMARY KEY,
  prompt_id TEXT NOT NULL,
  url TEXT NOT NULL,
  r2_key TEXT NOT NULL,
  type TEXT NOT NULL,
  file_size INTEGER,
  metadata TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (prompt_id) REFERENCES prompts(id) ON DELETE CASCADE
);

-- Jobs table - tracks long-running tasks like video generation
CREATE TABLE IF NOT EXISTS jobs (
  id TEXT PRIMARY KEY,
  type TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  progress INTEGER NOT NULL DEFAULT 0,
  result TEXT,
  error TEXT,
  metadata TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

-- Articles table - stores article content for video generation
CREATE TABLE IF NOT EXISTS articles (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  url TEXT,
  tags TEXT,
  author TEXT,
  summary TEXT,
  reading_time INTEGER,
  word_count INTEGER,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Scripts table - stores generated video scripts
CREATE TABLE IF NOT EXISTS scripts (
  id TEXT PRIMARY KEY,
  article_ids TEXT NOT NULL,
  content TEXT NOT NULL,
  segments TEXT NOT NULL,
  metadata TEXT,
  style TEXT,
  estimated_duration INTEGER,
  word_count INTEGER,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Audio files table - stores generated TTS and music files
CREATE TABLE IF NOT EXISTS audio_files (
  id TEXT PRIMARY KEY,
  script_id TEXT,
  type TEXT NOT NULL,
  file_url TEXT NOT NULL,
  duration REAL,
  file_size INTEGER,
  voice_config TEXT,
  transcription TEXT,
  metadata TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (script_id) REFERENCES scripts(id) ON DELETE CASCADE
);

-- Visual assets table - discovered images/videos for scenes
CREATE TABLE IF NOT EXISTS visual_assets (
  id TEXT PRIMARY KEY,
  script_id TEXT,
  scene_number INTEGER,
  type TEXT NOT NULL,
  provider TEXT NOT NULL,
  source_url TEXT NOT NULL,
  thumbnail_url TEXT,
  title TEXT,
  description TEXT,
  tags TEXT,
  duration REAL,
  metadata TEXT,
  score REAL,
  selected BOOLEAN DEFAULT FALSE,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (script_id) REFERENCES scripts(id) ON DELETE CASCADE
);

-- Indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_prompts_status ON prompts(status);
CREATE INDEX IF NOT EXISTS idx_prompts_created_at ON prompts(created_at);
CREATE INDEX IF NOT EXISTS idx_outputs_prompt_id ON outputs(prompt_id);
CREATE INDEX IF NOT EXISTS idx_jobs_status ON jobs(status);
CREATE INDEX IF NOT EXISTS idx_jobs_type ON jobs(type);
CREATE INDEX IF NOT EXISTS idx_jobs_created_at ON jobs(created_at);
CREATE INDEX IF NOT EXISTS idx_articles_created_at ON articles(created_at);
CREATE INDEX IF NOT EXISTS idx_scripts_created_at ON scripts(created_at);
CREATE INDEX IF NOT EXISTS idx_audio_files_script_id ON audio_files(script_id);
CREATE INDEX IF NOT EXISTS idx_visual_assets_script_id ON visual_assets(script_id);
CREATE INDEX IF NOT EXISTS idx_visual_assets_selected ON visual_assets(selected);