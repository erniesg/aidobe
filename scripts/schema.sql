-- Prompts table to store all generation requests
CREATE TABLE IF NOT EXISTS prompts (
  id TEXT PRIMARY KEY,
  original_prompt TEXT NOT NULL,
  enhanced_prompt TEXT,
  model TEXT NOT NULL,
  model_version TEXT,
  parameters TEXT, -- JSON string
  status TEXT NOT NULL DEFAULT 'pending', -- pending, processing, completed, failed
  error_message TEXT,
  created_at INTEGER NOT NULL,
  completed_at INTEGER,
  user_agent TEXT,
  ip_address TEXT
);

-- Outputs table to store generated media
CREATE TABLE IF NOT EXISTS outputs (
  id TEXT PRIMARY KEY,
  prompt_id TEXT NOT NULL,
  url TEXT NOT NULL,
  r2_key TEXT NOT NULL,
  type TEXT NOT NULL, -- image, video
  width INTEGER,
  height INTEGER,
  duration REAL, -- for videos, in seconds
  file_size INTEGER,
  metadata TEXT, -- JSON string for additional data
  created_at INTEGER NOT NULL,
  FOREIGN KEY (prompt_id) REFERENCES prompts(id)
);

-- Analytics table for tracking usage patterns
CREATE TABLE IF NOT EXISTS analytics (
  id TEXT PRIMARY KEY,
  event_type TEXT NOT NULL, -- generation_started, generation_completed, download, enhancement
  prompt_id TEXT,
  model TEXT,
  timestamp INTEGER NOT NULL,
  duration_ms INTEGER,
  metadata TEXT -- JSON string
);

-- Jobs table for managing long-running tasks
CREATE TABLE IF NOT EXISTS jobs (
  id TEXT PRIMARY KEY,
  type TEXT NOT NULL, -- video_generation, script_generation, asset_discovery, audio_processing
  status TEXT NOT NULL DEFAULT 'pending', -- pending, processing, completed, failed, cancelled
  progress INTEGER NOT NULL DEFAULT 0, -- 0-100
  result TEXT, -- JSON string for job result
  error TEXT, -- Error message if failed
  metadata TEXT NOT NULL, -- JSON string for job metadata (steps, userId, priority, etc.)
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

-- Indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_prompts_created_at ON prompts(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_prompts_status ON prompts(status);
CREATE INDEX IF NOT EXISTS idx_outputs_prompt_id ON outputs(prompt_id);
CREATE INDEX IF NOT EXISTS idx_outputs_type ON outputs(type);
CREATE INDEX IF NOT EXISTS idx_analytics_timestamp ON analytics(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_analytics_event_type ON analytics(event_type);
CREATE INDEX IF NOT EXISTS idx_jobs_status ON jobs(status);
CREATE INDEX IF NOT EXISTS idx_jobs_type ON jobs(type);
CREATE INDEX IF NOT EXISTS idx_jobs_created_at ON jobs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_jobs_user_id ON jobs(JSON_EXTRACT(metadata, '$.userId'));