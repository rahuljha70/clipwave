/**
 * The processing pipeline. Runs inside the background worker (never in a request
 * handler) and writes progress to `projects`/`clips` so the UI can stream it.
 *
 *  1 import      resolve metadata + acquire media (download or upload)
 *  2 probe       ffprobe: duration / resolution / fps / audio
 *  3 transcribe  Whisper (local faster-whisper or OpenAI) with word timestamps
 *  4 features    acoustic feature extraction (RMS, flux, pitch, speech ratio)
 *  5 detect      moment detection + viral scoring (+ optional LLM re-rank)
 *  6 render      ffmpeg cut + 9:16 reframe + burned animated captions
 *  7 seo         titles / description / hashtags / scores
 *  8 thumbnails  best-frame + composed cover
 */
import fs from "node:fs";
import path from "node:path";
import { env } from "./env";
import { nowIso, q, q1, run, type Row } from "./db";
import { recordUsage } from "./entitlements";
import { getEffectivePlan, getPlan } from "./plans";
import * as storage from "./storage";
import {
  captureFrames,
  captureFramesEvery,
  extractAudio,
  extractAudioF32,
  grabStill,
  muxAudioVideo,
  probe,
  renderBrandCard,
  renderClip,
  resolutionFor,
  concatVideos,
} from "./media/ffmpeg";
import {
  buildAss,
  buildSrt,
  DEFAULT_SUBTITLE_CONFIG,
  STYLE_PRESETS,
  sliceWords,
  wordsToText,
  type SubtitleConfig,
  type SubtitleStyleId,
  type Transcript,
} from "./media/subtitles";
import { analyzeAudioFeatures, trackFaces, transcribe, type FaceTrack } from "./ai/stt";
import { detectMoments, type Moment } from "./ai/analyze";
import { generateSeo } from "./ai/seo";
import { composeThumbnail, pickBestFrame } from "./thumbnails";
import { llmEnabled } from "./env";
import { downloadSource, type SourceMeta } from "./sources";
import { errorMessage } from "./utils";

export type ProgressFn = (patch: {
  stage?: string;
  progress?: number;
  meta?: Record<string, unknown>;
}) => Promise<void>;

const CLIP_STATUS_LABEL: Record<string, string> = {
  pending: "Queued",
  rendering: "Rendering",
  ready: "Ready",
  failed: "Failed",
};

export function defaultSubtitleConfig(styleId: string, planId: string): SubtitleConfig {
  const plan = getPlan(planId);
  const allowed = plan.subtitleStyles as SubtitleStyleId[];
  const style = (allowed.includes(styleId as SubtitleStyleId) ? styleId : allowed[0]) as SubtitleStyleId;
  return { ...DEFAULT_SUBTITLE_CONFIG, ...STYLE_PRESETS[style], style };
}

/* ------------------------------ project flow ------------------------------ */

export async function processProject(projectId: string, log: (stage: string) => Promise<void> = async () => {}) {
  const project = await q1<Row>(`SELECT * FROM projects WHERE id = ?`, [projectId]);
  if (!project) throw new Error(`Project ${projectId} not found`);
  const owner = project.user_id
    ? await q1<Row>(`SELECT plan, role FROM users WHERE id = ?`, [project.user_id])
    : null;
  const isAdmin = owner?.role === "admin";
  const plan = getEffectivePlan(owner?.plan, isAdmin);

  const progress: ProgressFn = async (patch) => {
    if (patch.stage) await log(patch.stage);
    await run(
      `UPDATE projects SET stage = COALESCE(?, stage), progress = COALESCE(?, progress),
              updated_at = ? WHERE id = ?`,
      [patch.stage ?? null, patch.progress ?? null, nowIso(), projectId],
    );
    if (patch.meta) {
      const current = project.analysis_json ? JSON.parse(project.analysis_json) : {};
      await run(`UPDATE projects SET analysis_json = ? WHERE id = ?`, [
        JSON.stringify({ ...current, ...patch.meta }),
        projectId,
      ]);
    }
  };

  const workDir = storage.absPath(path.join(storage.projectDir(projectId)));
  await storage.ensureDir(workDir);

  try {
    await run(`UPDATE projects SET status = 'processing', error = NULL, started_at = ?, updated_at = ? WHERE id = ?`, [
      nowIso(),
      nowIso(),
      projectId,
    ]);

    /* 0 — make re-runs idempotent ------------------------------------------ */
    const existingClips = await q<{ id: string }>(`SELECT id FROM clips WHERE project_id = ?`, [projectId]);
    for (const clip of existingClips) {
      await storage.removeRel(`projects/${projectId}/clips/${clip.id}`).catch(() => {});
    }
    await run(`DELETE FROM clips WHERE project_id = ?`, [projectId]);
    await run(`DELETE FROM exports WHERE project_id = ?`, [projectId]);
    await run(`UPDATE projects SET clip_count = 0 WHERE id = ?`, [projectId]);

    /* 1 — acquire media ---------------------------------------------------- */
    let mediaPath = project.media_path ? storage.absPath(project.media_path) : "";
    if (!mediaPath || !fs.existsSync(mediaPath)) {
      if (project.source_type === "upload") {
        throw new Error("Uploaded file is missing from storage. Re-upload and retry.");
      }
      await progress({ stage: "Fetching source video", progress: 4 });
      const source: SourceMeta = {
        platform: project.platform,
        sourceId: project.source_id ?? "",
        url: project.source_url,
        title: project.title,
        channel: project.channel,
        thumbnailUrl: project.thumbnail_url,
        durationSec: Number(project.duration_sec ?? 0),
        isLive: false,
        isDownloadable: true,
      };
      const download = await downloadSource(source, workDir, (percent, label) => {
        void progress({ stage: `${label} — ${percent}%`, progress: Math.min(14, 3 + Math.round(percent * 0.11)) });
      });
      mediaPath = download.filePath;
      const rel = path.relative(storage.absPath(""), mediaPath).split(path.sep).join("/");
      await run(`UPDATE projects SET media_path = ? WHERE id = ?`, [rel, projectId]);
    }

    /* 2 — probe ------------------------------------------------------------ */
    await progress({ stage: "Inspecting video", progress: 15 });
    let info = await probe(mediaPath);
    if (!info.hasAudio && project.source_type !== "upload") {
      const audioFile = fs
        .readdirSync(workDir)
        .find((file) => file.startsWith("source.") && /\.(m4a|aac|mp3|opus|weba|wav|mka|ogg)$/i.test(file));
      if (audioFile) {
        const repairedPath = path.join(workDir, "source.with-audio.mp4");
        const existingRepair = fs.existsSync(repairedPath)
          ? await probe(repairedPath).catch(() => null)
          : null;
        if (existingRepair?.hasAudio) {
          mediaPath = repairedPath;
          info = existingRepair;
        } else {
          await progress({ stage: "Merging downloaded audio", progress: 15 });
          await muxAudioVideo(mediaPath, path.join(workDir, audioFile), repairedPath);
          mediaPath = repairedPath;
          info = await probe(mediaPath);
        }
        if (info.hasAudio) {
          const rel = path.relative(storage.absPath(""), mediaPath).split(path.sep).join("/");
          await run(`UPDATE projects SET media_path = ? WHERE id = ?`, [rel, projectId]);
        }
      }
    }
    const duration = info.durationSec || Number(project.duration_sec ?? 0);
    if (!duration) throw new Error("Could not read the video duration — the file may be corrupt.");
    await run(`UPDATE projects SET duration_sec = ? WHERE id = ?`, [duration, projectId]);

    /* 2b — poster frame (uploads have no remote thumbnail) ------------------ */
    if (!project.thumbnail_url) {
      try {
        const posterRel = `projects/${projectId}/poster.jpg`;
        await grabStill(mediaPath, Math.min(Math.max(duration * 0.1, 0.5), 30), storage.absPath(posterRel), 1280);
        await run(`UPDATE projects SET thumbnail_url = ? WHERE id = ?`, [
          `/api/media/${posterRel}`,
          projectId,
        ]);
      } catch {
        /* non-fatal: the UI falls back to a gradient placeholder */
      }
    }

    if (!isAdmin && duration > plan.maxSourceMinutes * 60) {
      throw new Error(
        `This source is ${Math.round(duration / 60)} min; your plan supports up to ${plan.maxSourceMinutes} min.`,
      );
    }

    /* 3 — transcribe ------------------------------------------------------- */
    let transcript: Transcript = { language: "en", words: [], segments: [], provider: "none" };
    if (info.hasAudio && env.sttProvider !== "none") {
      await progress({ stage: "Transcribing audio (Whisper)", progress: 20 });
      const wav = path.join(workDir, "audio.wav");
      await extractAudio(mediaPath, wav);
      transcript = await transcribe(wav, { language: "auto" });
      await run(`UPDATE projects SET detected_language = ? WHERE id = ?`, [
        transcript.language,
        projectId,
      ]);
      fs.writeFileSync(path.join(workDir, "transcript.json"), JSON.stringify(transcript));
    }

    /* 4 — acoustic features ------------------------------------------------ */
    await progress({ stage: "Analysing audio energy", progress: 38 });
    if (info.hasAudio) {
      const pcm = path.join(workDir, "audio.f32");
      await extractAudioF32(mediaPath, pcm);
      const features = await analyzeAudioFeatures(pcm);
      fs.writeFileSync(path.join(workDir, "features.json"), JSON.stringify(features));

      /* 5 — moment detection ---------------------------------------------- */
      await progress({ stage: "Detecting viral moments", progress: 46 });
      const targetLength = Number(project.target_length ?? 30);
      const requestedClips = Number(project.requested_clips ?? 8);
      const maxClips = Math.min(
        requestedClips,
        isAdmin ? requestedClips : plan.clipsPerProject,
        Math.max(1, Math.floor(duration / Math.max(12, targetLength * 0.6))),
      );
      const { moments, meta } = await detectMoments(transcript, features, {
        targetLength,
        maxClips,
        useLlm: llmEnabled,
        title: project.title,
        channel: project.channel,
        language: transcript.language,
      });

      await run(`UPDATE projects SET moments_json = ? WHERE id = ?`, [
        JSON.stringify(moments.map((m) => sanitizeMoment(m))),
        projectId,
      ]);
      await progress({
        stage: `Scored ${moments.length} candidate moments`,
        progress: 52,
        meta: { analysis: meta, transcriptWords: transcript.words.length },
      });

      /* 6-8 — render each clip ------------------------------------------- */
      const renderOwner = await q1<Row>(`SELECT plan, role FROM users WHERE id = ?`, [project.user_id]);
      const plan2 = getEffectivePlan(renderOwner?.plan, renderOwner?.role === "admin");
      const aspect = project.aspect ?? "9:16";
      const resolution = { w: 0, h: 0 };
      void resolution;

      let faceTrack: FaceTrack | null = null;
      if (aspect === "9:16" && moments.length) {
        const first = moments[0];
        const framesDir = path.join(workDir, "frames");
        await progress({ stage: "Tracking faces for auto-reframe", progress: 55 });
        const frames = await captureFramesEvery(mediaPath, framesDir, {
          startSec: first.start,
          durationSec: Math.min(first.duration, 60),
          everySec: 1,
          width: 480,
        });
        if (frames.length) {
          faceTrack = await trackFaces({
            framesDir,
            every: 1,
            sourceWidth: info.width || 1920,
            outputWidth: 1080,
          });
          fs.writeFileSync(path.join(workDir, "face-track.json"), JSON.stringify(faceTrack));
        }
      }

      let created = 0;
      for (let i = 0; i < moments.length; i++) {
        const moment = moments[i];
        const clipId = await createClipRow(project, moment, i, transcript);
        await run(`UPDATE projects SET clip_count = ? WHERE id = ?`, [i + 1, projectId]);
        const baseProgress = 56 + Math.round(((i + 1) / moments.length) * 34);
        await progress({
          stage: `Rendering clip ${i + 1} of ${moments.length}`,
          progress: Math.min(93, baseProgress),
        });
        try {
          await renderClipArtifacts({
            project,
            moment,
            clipId,
            transcript,
            mediaPath,
            workDir,
            aspect,
            plan: plan2,
            faceTrack,
            sourceInfo: info,
            log,
          });
          created++;
          await recordUsage({
            userId: project.user_id,
            kind: "clip_created",
            projectId,
            clipId,
          });
        } catch (err: unknown) {
          await run(`UPDATE clips SET status='failed', error=?, updated_at=? WHERE id=?`, [
            errorMessage(err).slice(0, 600),
            nowIso(),
            clipId,
          ]);
          await log(`Clip ${i + 1} failed: ${errorMessage(err)}`);
        }
      }

      await run(
        `UPDATE projects SET status = ?, progress = 100, stage = ?, finished_at = ?, updated_at = ?
          WHERE id = ?`,
        [
          created > 0 ? "ready" : "failed",
          created > 0 ? `Ready — ${created} clips` : "No clips could be rendered",
          nowIso(),
          nowIso(),
          projectId,
        ],
      );
      await recordUsage({
        userId: project.user_id,
        kind: "processed_seconds",
        seconds: Math.round(duration),
        projectId,
        meta: { clips: created },
      });
      if (!created) throw new Error("No clips could be rendered for this video.");
      return;
    }

    throw new Error("This video has no audio track, so there is nothing to clip. Try another source.");
  } catch (error: unknown) {
    await run(
      `UPDATE projects SET status = 'failed', error = ?, stage = ?, updated_at = ? WHERE id = ?`,
      [errorMessage(error).slice(0, 1000), "Failed", nowIso(), projectId],
    );
    throw error;
  }
}

function sanitizeMoment(m: Moment) {
  const { words, ...rest } = m;
  return { ...rest, wordCount: words.length };
}

async function createClipRow(project: Row, moment: Moment, index: number, transcript: Transcript) {
  const id = crypto.randomUUID();
  const words = transcript.words.filter((w) => w.end > moment.start && w.start < moment.end);
  await run(
    `INSERT INTO clips (id, project_id, user_id, position, title, hook, start_sec, end_sec, duration_sec,
                        category, viral_score, score_json, reason, best_platform, improvements_json,
                        transcript_text, words_json, speakers_json, status, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'rendering', ?, ?)`,
    [
      id,
      project.id,
      project.user_id,
      index,
      moment.hook?.slice(0, 180) ?? `Clip ${index + 1}`,
      moment.hook ?? "",
      moment.start,
      moment.end,
      moment.duration,
      moment.category,
      moment.score,
      JSON.stringify(moment.breakdown),
      moment.reason,
      moment.bestPlatform,
      JSON.stringify(moment.improvements),
      wordsToText(words).slice(0, 4000),
      JSON.stringify(words.map((w) => ({ ...w, start: Math.max(0, w.start - moment.start), end: Math.max(0.05, w.end - moment.start) }))),
      JSON.stringify(moment.speakers),
      nowIso(),
      nowIso(),
    ],
  );
  return id;
}

export interface RenderClipInput {
  project: Row;
  moment: Moment;
  clipId: string;
  transcript: Transcript;
  mediaPath: string;
  workDir: string;
  aspect: string;
  plan: ReturnType<typeof getPlan>;
  faceTrack?: FaceTrack | null;
  sourceInfo?: { width: number; height: number; fps: number };
  log?: (msg: string) => Promise<void>;
  overrides?: {
    start?: number;
    end?: number;
    subtitleConfig?: Partial<SubtitleConfig>;
    edits?: Record<string, unknown>;
    textOverlay?: { text: string; position: "top" | "bottom"; startSec: number; endSec: number } | null;
    words?: { start: number; end: number; word: string; speaker?: number }[];
    aspect?: string;
  };
}

/** Renders every artifact for a single clip (video, SRT, SEO, thumbnail). */
export async function renderClipArtifacts(input: RenderClipInput) {
  const { project, clipId, transcript, mediaPath, workDir, plan } = input;
  const aspect = (input.overrides?.aspect as string | undefined) ?? input.aspect ?? "9:16";
  const moment = input.moment;
  const start = input.overrides?.start ?? moment.start;
  const end = input.overrides?.end ?? moment.end;
  const duration = Math.max(2, end - start);
  const clipDir = path.join(workDir, "clips", clipId);
  await storage.ensureDir(clipDir);

  const edits = input.overrides?.edits ?? {};
  const cropMode = (edits.cropMode ?? "face") as "face" | "center" | "blur";
  const speed = Number(edits.speed ?? 1);
  const subtitleStyle = String(edits.subtitleStyle ?? "mrbeast");
  const cfg = mergingSubtitleConfig(input.overrides?.subtitleConfig, subtitleStyle, plan.id, edits);

  /* captions ------------------------------------------------------------- */
  // Edited captions (from the studio) win; otherwise the transcript for the range.
  const clipWords = input.overrides?.words?.length
    ? input.overrides.words
    : sliceWords(transcript.words ?? [], start, end);
  const { w: width, h: height } = resolutionFor(aspect, plan.maxResolution);
  const localTranscript: Transcript = { ...transcript, words: clipWords };

  let assName: string | null = null;
  if (clipWords.length) {
    const ass = buildAss(localTranscript, cfg, { width, height, offsetSec: 0 });
    fs.writeFileSync(path.join(clipDir, "subs.ass"), ass);
    assName = "subs.ass";
  }
  fs.writeFileSync(
    path.join(clipDir, "subs.srt"),
    buildSrt(localTranscript, cfg),
  );

  /* render --------------------------------------------------------------- */
  const outName = "clip.mp4";
  const renderPath = path.join(clipDir, outName);
  const relativeMedia = path.relative(clipDir, mediaPath).split(path.sep).join("/");
  const cropPath = input.faceTrack?.points
    ?.filter((p) => p.x !== null)
    .map((p) => ({ t: p.t, x: p.x as number }));

  await run(`UPDATE clips SET progress = 10 WHERE id = ?`, [clipId]);

  const music = resolveMusic(edits);
  await renderClip({
    input: relativeMedia,
    output: outName,
    cwd: clipDir,
    startSec: start,
    durationSec: duration,
    aspect,
    height: plan.maxResolution as 720 | 1080,
    fps: Math.min(Number(edits.fps ?? plan.maxFps) || plan.maxFps, plan.maxFps) as 30 | 60,
    cropMode: aspect === "9:16" ? cropMode : "center",
    cropPath,
    subtitleFile: assName,
    watermark: plan.watermark,
    music: music
      ? {
          file: path.relative(clipDir, music).split(path.sep).join("/"),
          volume: Number(edits.musicVolume ?? 0.18),
        }
      : null,
    speed,
    overlayText: input.overrides?.textOverlay ?? null,
    onProgress: undefined,
  });

  await run(`UPDATE clips SET progress = 70 WHERE id = ?`, [clipId]);

  /* intro / outro -------------------------------------------------------- */
  let finalPath = renderPath;
  const wantIntro = Boolean(edits.introEnabled);
  const wantOutro = Boolean(edits.outroEnabled);
  if (wantIntro || wantOutro) {
    const parts: string[] = [];
    if (wantIntro) {
      const intro = await renderBrandCard({
        output: "intro.mp4",
        cwd: clipDir,
        text: String(edits.introText ?? "Clipwave"),
        subtitle: String(edits.introSubtitle ?? ""),
        width,
        height,
        seconds: 1.2,
      });
      parts.push(intro);
    }
    parts.push(outName);
    if (wantOutro) {
      const outro = await renderBrandCard({
        output: "outro.mp4",
        cwd: clipDir,
        text: String(edits.outroText ?? "Follow for more"),
        subtitle: String(edits.outroSubtitle ?? ""),
        width,
        height,
        seconds: 1.4,
      });
      parts.push(outro);
    }
    finalPath = await concatVideos(parts, "final.mp4", clipDir);
  }

  /* thumbnail ------------------------------------------------------------ */
  const thumbTimes = [0.25, 0.5, 0.75].map((f) => start + duration * f);
  const stills = await captureFrames(mediaPath, path.join(clipDir, "stills"), {
    times: thumbTimes,
    width: 1280,
  });
  const bestStill = (await pickBestFrame(stills)) ?? null;

  const seo = await generateSeo({
    moment,
    sourceTitle: project.title,
    channel: project.channel,
    platform: project.platform ?? "upload",
    language: transcript.language,
    useLlm: llmEnabled,
  });

  let thumbRel: string | null = null;
  if (bestStill) {
    const thumbAbs = path.join(clipDir, "thumbnail.jpg");
    await composeThumbnail({
      framePath: bestStill,
      outputPath: thumbAbs,
      text: seo.thumbnailText,
      badge: `${moment.score}`,
      category: moment.category,
    });
    thumbRel = toRel(thumbAbs);

    /* portrait twin — the in-app cards and Shorts covers are 9:16 */
    await composeThumbnail({
      framePath: bestStill,
      outputPath: path.join(clipDir, "thumbnail-9x16.jpg"),
      text: seo.thumbnailText,
      badge: `${moment.score}`,
      category: moment.category,
      width: 1080,
      height: 1920,
    }).catch(() => {});
  }

  /* player poster: a clean frame from the rendered clip itself */
  await grabStill(finalPath, 0.3, path.join(clipDir, "poster.jpg"), 1080).catch(() => {});

  const renderRel = toRel(finalPath);
  const srtRel = toRel(path.join(clipDir, "subs.srt"));

  await run(
    `UPDATE clips SET status='ready', progress=100, title=?, seo_json=?, thumbnail_path=?, render_path=?,
            render_1080_path=?, render_720_path=NULL, srt_path=?, ass_json=?, edits_json=?, error=NULL,
            start_sec=?, end_sec=?, duration_sec=?, updated_at=?
      WHERE id = ?`,
    [
      seo.recommendedTitle,
      JSON.stringify(seo),
      thumbRel,
      renderRel,
      plan.maxResolution === 1080 ? renderRel : null,
      srtRel,
      JSON.stringify(cfg),
      JSON.stringify(edits),
      start,
      end,
      duration,
      nowIso(),
      clipId,
    ],
  );

  return { renderRel, thumbRel, seo };
}

function mergingSubtitleConfig(
  override: Partial<SubtitleConfig> | undefined,
  styleId: string,
  planId: string,
  edits: Record<string, unknown>,
): SubtitleConfig {
  const base = defaultSubtitleConfig(styleId, planId);
  const merged: SubtitleConfig = { ...base, ...(override ?? {}) };
  if (edits.subtitleFont) merged.fontFamily = String(edits.subtitleFont);
  if (edits.subtitleSize) merged.fontSize = Number(edits.subtitleSize);
  if (edits.subtitleColor) merged.textColor = String(edits.subtitleColor);
  if (edits.subtitleHighlight) merged.highlightColor = String(edits.subtitleHighlight);
  if (["top", "middle", "bottom"].includes(String(edits.subtitlePosition))) {
    merged.position = edits.subtitlePosition as SubtitleConfig["position"];
  }
  if (edits.subtitleUppercase !== undefined) merged.uppercase = Boolean(edits.subtitleUppercase);
  if (edits.subtitleEmoji !== undefined) merged.emoji = Boolean(edits.subtitleEmoji);
  if (edits.subtitleWords) merged.maxWordsPerLine = Number(edits.subtitleWords);
  if (["pop", "fade", "slide", "none"].includes(String(edits.subtitleAnimation))) {
    merged.animation = edits.subtitleAnimation as SubtitleConfig["animation"];
  }
  if (edits.subtitleOutline !== undefined) merged.outline = Number(edits.subtitleOutline);
  if (edits.subtitleShadow !== undefined) merged.shadow = Number(edits.subtitleShadow);
  if (edits.subtitleLatin !== undefined) merged.speakerLabels = false;
  return merged;
}

/** Built-in royalty-free music bed (see public/audio/README.md). */
export function resolveMusic(edits: Record<string, unknown>): string | null {
  const id = edits?.musicId;
  if (!id || typeof id !== "string") return null;
  const safe = id.replace(/[^a-z0-9-_]/gi, "");
  if (!safe) return null;
  const file = path.resolve("public/audio", `${safe}.mp3`);
  return fs.existsSync(file) ? file : null;
}

export function toRel(abs: string) {
  return path.relative(storage.absPath(""), abs).split(path.sep).join("/");
}

/** Re-render a single clip after the user edits it in the studio. */
export async function rerenderClip(
  clipId: string,
  overrides: {
    start?: number;
    end?: number;
    subtitleConfig?: Partial<SubtitleConfig>;
    edits?: Record<string, unknown>;
    words?: { start: number; end: number; word: string; speaker?: number }[];
    aspect?: string;
  },
  log: (msg: string) => Promise<void> = async () => {},
) {
  const clip = await q1<Row>(`SELECT * FROM clips WHERE id = ?`, [clipId]);
  if (!clip) throw new Error("Clip not found");
  const project = await q1<Row>(`SELECT * FROM projects WHERE id = ?`, [clip.project_id]);
  if (!project) throw new Error("Project not found");
  const user = await q1<Row>(`SELECT plan, role FROM users WHERE id = ?`, [clip.user_id]);
  const plan = getEffectivePlan(user?.plan ?? "free", user?.role === "admin");

  const workDir = storage.absPath(storage.projectDir(project.id));
  const mediaPath = project.media_path ? storage.absPath(project.media_path) : "";
  if (!mediaPath || !fs.existsSync(mediaPath)) throw new Error("Source media is no longer available.");

  const transcriptPath = path.join(workDir, "transcript.json");
  const transcript: Transcript = fs.existsSync(transcriptPath)
    ? JSON.parse(fs.readFileSync(transcriptPath, "utf8"))
    : { language: "en", words: JSON.parse(clip.words_json ?? "[]"), segments: [] };

  const moment: Moment = {
    start: Number(clip.start_sec),
    end: Number(clip.end_sec),
    duration: Number(clip.duration_sec),
    score: Number(clip.viral_score),
    category: (clip.category ?? "conversation") as Moment["category"],
    reason: clip.reason ?? "",
    hook: clip.hook ?? "",
    bestPlatform: clip.best_platform ?? "TikTok",
    improvements: JSON.parse(clip.improvements_json ?? "[]"),
    breakdown: JSON.parse(clip.score_json ?? "{}"),
    transcript: clip.transcript_text ?? "",
    words: [],
    speakers: JSON.parse(clip.speakers_json ?? "[]"),
  };

  let faceTrack: FaceTrack | null = null;
  const trackPath = path.join(workDir, "face-track.json");
  if (fs.existsSync(trackPath)) faceTrack = JSON.parse(fs.readFileSync(trackPath, "utf8"));

  await run(`UPDATE clips SET status='rendering', progress=0, error=NULL, updated_at=? WHERE id=?`, [
    nowIso(),
    clipId,
  ]);
  try {
    const out = await renderClipArtifacts({
      project,
      moment,
      clipId,
      transcript,
      mediaPath,
      workDir,
      aspect: project.aspect ?? "9:16",
      plan,
      faceTrack,
      log,
      overrides,
    });
    await log(`Re-rendered clip at ${out.renderRel}`);
    return out;
  } catch (err: unknown) {
    await run(`UPDATE clips SET status='failed', error=?, updated_at=? WHERE id=?`, [
      errorMessage(err).slice(0, 600),
      nowIso(),
      clipId,
    ]);
    throw err;
  }
}

export { CLIP_STATUS_LABEL };
