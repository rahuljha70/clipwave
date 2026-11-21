import type { Row } from "./db";

export function projectToDto(row: Row) {
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
