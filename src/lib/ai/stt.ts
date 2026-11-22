/**
 * Speech-to-text providers.
 *  local  -> faster-whisper via python worker (offline, multilingual, no API key)
 *  openai -> Whisper API (set STT_PROVIDER=openai + OPENAI_API_KEY)
 *  none   -> transcription disabled; clips are cut from acoustic features only
 */
import fs from "node:fs";
import path from "node:path";
import { z } from "zod";
import { env } from "../env";
import { run as spawnRun } from "../media/ffmpeg";
import type { Transcript } from "../media/subtitles";

export interface AudioFrame {
  t: number;
  rms: number;
  rmsDb: number;
  zcr: number;
  centroid: number;
  flux: number;
  pitch: number;
  speech: boolean;
}

export interface AudioFeatures {
  sr: number;
  window: number;
  duration: number;
  frames: AudioFrame[];
}

const SCRIPT_DIR = path.resolve("python");

const transcriptionSchema = z.object({
  error: z.string().optional(),
  language: z.string().optional(),
  words: z.array(z.object({
    start: z.coerce.number(),
    end: z.coerce.number(),
    word: z.coerce.string(),
    speaker: z.coerce.number().optional(),
    probability: z.coerce.number().optional(),
  })).optional(),
  segments: z.array(z.object({
    start: z.coerce.number(),
    end: z.coerce.number(),
    text: z.coerce.string().optional(),
    speaker: z.coerce.number().optional(),
  })).optional(),
});

export async function analyzeAudioFeatures(pcmPath: string): Promise<AudioFeatures> {
  const out = `${pcmPath}.features.json`;
  const res = await spawnRun(
    env.pythonBin,
    [path.join(SCRIPT_DIR, "audio_features.py"), "--pcm", pcmPath, "--out", out],
    { timeoutMs: 300_000 },
  );
  if (res.code !== 0) {
    throw new Error(`Audio feature extraction failed: ${(res.stdout || res.stderr).slice(-400)}`);
  }
  return JSON.parse(fs.readFileSync(out, "utf8")) as AudioFeatures;
}

export interface FaceTrack {
  faceRatio: number;
  detected: number;
  total: number;
  points: { t: number; x: number | null }[];
  cropWidth: number;
}

/** Face-aware crop path for vertical reframing. */
export async function trackFaces(opts: {
  framesDir: string;
  every: number;
  sourceWidth: number;
  outputWidth: number;
}): Promise<FaceTrack | null> {
  const out = path.join(opts.framesDir, "track.json");
  const res = await spawnRun(
    env.pythonBin,
    [
      path.join(SCRIPT_DIR, "face_track.py"),
      "--frames",
      opts.framesDir,
      "--out",
      out,
      "--every",
      String(opts.every),
      "--source-width",
      String(opts.sourceWidth),
      "--width",
      String(opts.outputWidth),
    ],
    { timeoutMs: 300_000 },
  );
  if (res.code !== 0 || !fs.existsSync(out)) return null;
  return JSON.parse(fs.readFileSync(out, "utf8")) as FaceTrack;
}

export async function transcribeLocal(
  wavPath: string,
  opts: { language?: string; model?: string } = {},
): Promise<Transcript> {
  const out = `${wavPath}.transcript.json`;
  const args = [
    path.join(SCRIPT_DIR, "transcribe.py"),
    "--wav",
    wavPath,
    "--out",
    out,
    "--model",
    opts.model ?? env.whisperModel,
    "--device",
    env.whisperDevice,
    "--compute-type",
    env.whisperComputeType,
    "--language",
    opts.language ?? "auto",
  ];
  const res = await spawnRun(env.pythonBin, args, { timeoutMs: 60 * 60 * 1000 });
  if (res.code !== 0) {
    const message = (res.stdout || res.stderr || "unknown error").slice(-500);
    throw new Error(`Local transcription failed: ${message}`);
  }
  const parsed = transcriptionSchema.parse(JSON.parse(fs.readFileSync(out, "utf8")));
  if (parsed.error) throw new Error(parsed.error);
  return {
    language: parsed.language ?? "en",
    words: (parsed.words ?? []).map((w) => ({
      start: Number(w.start),
      end: Number(w.end),
      word: String(w.word),
      speaker: w.speaker ?? 0,
      probability: w.probability,
    })),
    segments: (parsed.segments ?? []).map((s) => ({
      start: Number(s.start),
      end: Number(s.end),
      text: String(s.text ?? ""),
      speaker: s.speaker ?? 0,
    })),
    provider: "faster-whisper",
    model: opts.model ?? env.whisperModel,
  };
}

export async function transcribeOpenAI(wavPath: string): Promise<Transcript> {
  const data = fs.readFileSync(wavPath);
  const form = new FormData();
  form.append("file", new Blob([new Uint8Array(data)], { type: "audio/wav" }), "audio.wav");
  form.append("model", "whisper-1");
  form.append("response_format", "verbose_json");
  form.append("timestamp_granularities[]", "word");
  form.append("timestamp_granularities[]", "segment");

  const res = await fetch("https://api.openai.com/v1/audio/transcriptions", {
    method: "POST",
    headers: { authorization: `Bearer ${env.openaiApiKey}` },
    body: form,
  });
  if (!res.ok) throw new Error(`Whisper API error ${res.status}: ${(await res.text()).slice(0, 300)}`);
  const json = transcriptionSchema.parse(await res.json());
  const words = (json.words ?? []).map((w) => ({
    start: Number(w.start),
    end: Number(w.end),
    word: String(w.word),
    speaker: 0,
  }));
  const segments = (json.segments ?? []).map((s) => ({
    start: Number(s.start),
    end: Number(s.end),
    text: String(s.text).trim(),
    speaker: 0,
  }));
  return {
    language: json.language ?? "en",
    words,
    segments,
    provider: "openai-whisper",
    model: "whisper-1",
  };
}

export async function transcribe(
  wavPath: string,
  opts: { language?: string } = {},
): Promise<Transcript> {
  if (env.sttProvider === "none") {
    return { language: opts.language ?? "en", words: [], segments: [], provider: "none" };
  }
  if (env.sttProvider === "openai") {
    if (!env.openaiApiKey) {
      throw new Error(
        "STT_PROVIDER=openai but OPENAI_API_KEY is missing. Set the key or use STT_PROVIDER=local.",
      );
    }
    return transcribeOpenAI(wavPath);
  }
  return transcribeLocal(wavPath, opts);
}

export function emptyTranscript(language = "en"): Transcript {
  return { language, words: [], segments: [], provider: "none" };
}
