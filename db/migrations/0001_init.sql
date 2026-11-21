-- Clipwave — initial schema
-- Portable SQL: runs on SQLite (local dev) and PostgreSQL / Supabase (production).
-- Rules for portability: TEXT ids (uuid), TEXT ISO-8601 timestamps, INTEGER booleans,
-- JSON stored as TEXT. No dialect-specific defaults -> values are written by the app.

CREATE TABLE IF NOT EXISTS users (
  id                 TEXT PRIMARY KEY,
  email              TEXT NOT NULL UNIQUE,
  password_hash      TEXT,
  name               TEXT,
  avatar_url         TEXT,
  role               TEXT NOT NULL DEFAULT 'user',          -- user | admin
  plan               TEXT NOT NULL DEFAULT 'free',          -- free | pro | ultimate
  plan_status        TEXT NOT NULL DEFAULT 'active',        -- active | past_due | canceled
  plan_renews_at     TEXT,
  provider           TEXT NOT NULL DEFAULT 'password',      -- password | google
  google_sub         TEXT,
  email_verified     INTEGER NOT NULL DEFAULT 0,
  onboarded          INTEGER NOT NULL DEFAULT 0,
  created_at         TEXT NOT NULL,
  updated_at         TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_users_provider ON users(provider);

CREATE TABLE IF NOT EXISTS sessions (
  id          TEXT PRIMARY KEY,
  user_id     TEXT NOT NULL,
  token_hash  TEXT NOT NULL UNIQUE,
  user_agent  TEXT,
  ip          TEXT,
  expires_at  TEXT NOT NULL,
  created_at  TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id);

CREATE TABLE IF NOT EXISTS password_resets (
  id          TEXT PRIMARY KEY,
  user_id     TEXT NOT NULL,
  token_hash  TEXT NOT NULL UNIQUE,
  expires_at  TEXT NOT NULL,
  used_at     TEXT,
  created_at  TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS projects (
  id                TEXT PRIMARY KEY,
  user_id           TEXT NOT NULL,
  title             TEXT NOT NULL,
  source_type       TEXT NOT NULL DEFAULT 'url',            -- url | upload
  source_url        TEXT,
  platform          TEXT,                                   -- youtube | kick | upload
  source_id         TEXT,
  channel           TEXT,
  thumbnail_url     TEXT,
  description       TEXT,
  duration_sec      REAL NOT NULL DEFAULT 0,
  status            TEXT NOT NULL DEFAULT 'queued',         -- queued | processing | ready | failed | canceled
  stage             TEXT,                                   -- human readable current step
  progress          INTEGER NOT NULL DEFAULT 0,
  error             TEXT,
  media_path        TEXT,
  detected_language TEXT,
  target_length     INTEGER NOT NULL DEFAULT 30,
  aspect            TEXT NOT NULL DEFAULT '9:16',
  clip_count        INTEGER NOT NULL DEFAULT 0,
  requested_clips   INTEGER NOT NULL DEFAULT 8,
  moments_json      TEXT,
  analysis_json     TEXT,
  created_at        TEXT NOT NULL,
  updated_at        TEXT NOT NULL,
  finished_at       TEXT
);
CREATE INDEX IF NOT EXISTS idx_projects_user ON projects(user_id, created_at);
CREATE INDEX IF NOT EXISTS idx_projects_status ON projects(status);

CREATE TABLE IF NOT EXISTS clips (
  id                TEXT PRIMARY KEY,
  project_id        TEXT NOT NULL,
  user_id           TEXT NOT NULL,
  position          INTEGER NOT NULL DEFAULT 0,
  title             TEXT,
  hook              TEXT,
  start_sec         REAL NOT NULL,
  end_sec           REAL NOT NULL,
  duration_sec      REAL NOT NULL,
  category          TEXT,                                   -- funny | gaming | emotional | rage | fact | ...
  viral_score       INTEGER NOT NULL DEFAULT 0,
  score_json        TEXT,
  reason            TEXT,
  best_platform     TEXT,
  improvements_json TEXT,
  transcript_text   TEXT,
  words_json        TEXT,
  speakers_json     TEXT,
  seo_json          TEXT,
  ass_json          TEXT,
  edits_json        TEXT,
  thumbnail_path    TEXT,
  render_path       TEXT,
  render_1080_path  TEXT,
  render_720_path   TEXT,
  srt_path          TEXT,
  status            TEXT NOT NULL DEFAULT 'pending',        -- pending | rendering | ready | failed
  progress          INTEGER NOT NULL DEFAULT 0,
  error             TEXT,
  saved             INTEGER NOT NULL DEFAULT 0,
  created_at        TEXT NOT NULL,
  updated_at        TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_clips_project ON clips(project_id, position);
CREATE INDEX IF NOT EXISTS idx_clips_user ON clips(user_id, created_at);

CREATE TABLE IF NOT EXISTS jobs (
  id          TEXT PRIMARY KEY,
  project_id  TEXT,
  user_id     TEXT,
  type        TEXT NOT NULL,                                -- process_project | render_clip | regenerate_seo
  status      TEXT NOT NULL DEFAULT 'queued',               -- queued | running | done | failed | canceled
  stage       TEXT,
  progress    INTEGER NOT NULL DEFAULT 0,
  error       TEXT,
  attempts    INTEGER NOT NULL DEFAULT 0,
  priority    INTEGER NOT NULL DEFAULT 0,
  worker_id   TEXT,
  locked_at   TEXT,
  payload_json TEXT,
  created_at  TEXT NOT NULL,
  updated_at  TEXT NOT NULL,
  finished_at TEXT
);
CREATE INDEX IF NOT EXISTS idx_jobs_status ON jobs(status, priority, created_at);
CREATE INDEX IF NOT EXISTS idx_jobs_project ON jobs(project_id);

CREATE TABLE IF NOT EXISTS job_logs (
  id         TEXT PRIMARY KEY,
  job_id     TEXT NOT NULL,
  level      TEXT NOT NULL DEFAULT 'info',
  message    TEXT NOT NULL,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_job_logs_job ON job_logs(job_id, created_at);

CREATE TABLE IF NOT EXISTS exports (
  id          TEXT PRIMARY KEY,
  user_id     TEXT NOT NULL,
  project_id  TEXT,
  clip_id     TEXT,
  kind        TEXT NOT NULL DEFAULT 'video',                -- video | srt | thumbnail
  aspect      TEXT,
  resolution  TEXT,
  fps         INTEGER,
  file_path   TEXT NOT NULL,
  size_bytes  INTEGER NOT NULL DEFAULT 0,
  label       TEXT,
  created_at  TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_exports_user ON exports(user_id, created_at);

CREATE TABLE IF NOT EXISTS usage_events (
  id         TEXT PRIMARY KEY,
  user_id    TEXT NOT NULL,
  kind       TEXT NOT NULL,                                 -- processed_seconds | clip_created | export
  seconds    REAL NOT NULL DEFAULT 0,
  project_id TEXT,
  clip_id    TEXT,
  meta_json  TEXT,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_usage_user ON usage_events(user_id, created_at);

CREATE TABLE IF NOT EXISTS user_settings (
  user_id      TEXT PRIMARY KEY,
  settings_json TEXT NOT NULL,
  updated_at   TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS error_logs (
  id         TEXT PRIMARY KEY,
  level      TEXT NOT NULL DEFAULT 'error',
  scope      TEXT,
  message    TEXT NOT NULL,
  stack      TEXT,
  context_json TEXT,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_error_logs_created ON error_logs(created_at);

CREATE TABLE IF NOT EXISTS admin_audit (
  id         TEXT PRIMARY KEY,
  admin_id   TEXT NOT NULL,
  action     TEXT NOT NULL,
  target     TEXT,
  meta_json  TEXT,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_audit_created ON admin_audit(created_at);
