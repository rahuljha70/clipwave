/** Shared mapping helpers for clip rows (used by API routes and the worker). */
import type { Row } from "./db";
import type { Moment } from "./ai/analyze";
import type { SeoResult } from "./ai/seo";
import { parseJson } from "./db";

export interface ClipDto {
  id: string;
  projectId: string;
  position: number;
  title: string;
  hook: string;
  startSec: number;
  endSec: number;
  durationSec: number;
  category: string;
  viralScore: number;
  scoreBreakdown: Record<string, number>;
  reason: string;
  bestPlatform: string;
  improvements: string[];
  transcript: string;
  status: string;
  progress: number;
  error: string | null;
  saved: boolean;
  seo: SeoResult | null;
  subtitleConfig: Record<string, unknown> | null;
  edits: Record<string, unknown> | null;
  thumbnailUrl: string | null;
  thumbnailPortraitUrl: string | null;
  posterUrl: string | null;
  videoUrl: string | null;
  srtUrl: string | null;
  createdAt: string;
}

export function clipToDto(row: Row): ClipDto {
  return {
    id: row.id,
    projectId: row.project_id,
    position: Number(row.position ?? 0),
    title: row.title ?? "Untitled clip",
    hook: row.hook ?? "",
    startSec: Number(row.start_sec ?? 0),
    endSec: Number(row.end_sec ?? 0),
    durationSec: Number(row.duration_sec ?? 0),
    category: row.category ?? "conversation",
    viralScore: Number(row.viral_score ?? 0),
    scoreBreakdown: parseJson<Record<string, number>>(row.score_json, {}),
    reason: row.reason ?? "",
    bestPlatform: row.best_platform ?? "TikTok",
    improvements: parseJson<string[]>(row.improvements_json, []),
    transcript: row.transcript_text ?? "",
    status: row.status ?? "pending",
    progress: Number(row.progress ?? 0),
    error: row.error ?? null,
    saved: Boolean(row.saved),
    seo: parseJson<SeoResult | null>(row.seo_json, null),
    subtitleConfig: parseJson<Record<string, unknown> | null>(row.ass_json, null),
    edits: parseJson<Record<string, unknown> | null>(row.edits_json, {}),
    thumbnailUrl: row.thumbnail_path ? mediaUrl(row.thumbnail_path) : null,
    thumbnailPortraitUrl: row.thumbnail_path
      ? mediaUrl(String(row.thumbnail_path).replace(/thumbnail\.jpg$/, "thumbnail-9x16.jpg"))
      : null,
    posterUrl: row.render_path
      ? mediaUrl(String(row.render_path).replace(/clip\.mp4$/, "poster.jpg"))
      : null,
    videoUrl: row.render_path ? mediaUrl(row.render_path) : null,
    srtUrl: row.srt_path ? mediaUrl(row.srt_path) : null,
    createdAt: row.created_at,
  };
}

export function mediaUrl(storagePath: string): string {
  return `/api/media/${storagePath.replace(/^\/+/, "")}`;
}

export function momentFromClip(row: Row): Moment {
  return {
    start: Number(row.start_sec ?? 0),
    end: Number(row.end_sec ?? 0),
    duration: Number(row.duration_sec ?? 0),
    score: Number(row.viral_score ?? 0),
    category: (row.category ?? "conversation") as Moment["category"],
    reason: row.reason ?? "",
    hook: row.hook ?? "",
    bestPlatform: row.best_platform ?? "TikTok",
    improvements: parseJson<string[]>(row.improvements_json, []),
    breakdown: parseJson<Moment["breakdown"]>(row.score_json, {
      hook: 0,
      retention: 0,
      emotion: 0,
      energy: 0,
      humor: 0,
      unexpected: 0,
      lengthFit: 0,
      context: 0,
    }),
    transcript: row.transcript_text ?? "",
    words: [],
    speakers: parseJson<number[]>(row.speakers_json, []),
  };
}
