-- Adds processing start timestamp used by the progress endpoint.
-- Safe to re-run: a duplicate-column error is ignored by the migration runner.
ALTER TABLE projects ADD COLUMN started_at TEXT;
