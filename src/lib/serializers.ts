import type { Row } from "./db";

export interface ProjectDto {
  id: string;
  title: string;
  platform: string;
  sourceUrl: string;
  sourceType: string;
  channel: string | null;
  thumbnailUrl: string | null;
  description: string | null;
  durationSec: number;
  status: string;
  stage: string;
  progress: number;
  error: string | null;
  clipCount: number;
  readyClips: number;
  requestedClips: number;
  targetLength: number;
  aspect: string;
  language: string | null;
  createdAt: string;
  finishedAt: string | null;
}

export function projectToDto(row: Row): ProjectDto {
  return {
    id: row.id,
    title: row.title,
    platform: row.platform,
    sourceUrl: row.source_url,
    sourceType: row.source_type,
    channel: row.channel,
    thumbnailUrl: row.thumbnail_url,
    description: row.description ?? null,
    durationSec: Number(row.duration_sec ?? 0),
    status: row.status,
    stage: row.stage,
    progress: Number(row.progress ?? 0),
    error: row.error,
    clipCount: Number(row.clip_count ?? 0),
    readyClips: Number(row.ready_clips ?? row.clip_count ?? 0),
    requestedClips: Number(row.requested_clips ?? 0),
    targetLength: Number(row.target_length ?? 30),
    aspect: row.aspect,
    language: row.detected_language,
    createdAt: row.created_at,
    finishedAt: row.finished_at,
  };
}
