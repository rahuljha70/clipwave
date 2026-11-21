/**
 * Environment loading + accessors.
 *
 * Next.js loads `.env.local` automatically, but the background worker and CLI
 * scripts run outside Next, so we parse env files ourselves when needed.
 * Existing process.env values always win.
 */
import fs from "node:fs";
import path from "node:path";

let loaded = false;

function parseEnvFile(file: string) {
  if (!fs.existsSync(file)) return;
  const raw = fs.readFileSync(file, "utf8");
  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (process.env[key] === undefined) process.env[key] = value;
  }
}

export function loadEnv() {
  if (loaded) return;
  loaded = true;
  const cwd = process.cwd();
  for (const name of [".env.local", ".env"]) {
    parseEnvFile(path.join(cwd, name));
  }
}

loadEnv();

const bool = (v: string | undefined, fallback = false) => {
  if (v === undefined) return fallback;
  return ["1", "true", "yes", "on"].includes(v.toLowerCase());
};

const num = (v: string | undefined, fallback: number) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
};

export const env = {
  nodeEnv: process.env.NODE_ENV ?? "development",
  appUrl: process.env.APP_URL ?? `http://localhost:${process.env.PORT ?? 3000}`,

  /** Postgres / Supabase connection string. Empty -> local SQLite file. */
  databaseUrl: process.env.DATABASE_URL ?? "",
  sqlitePath: process.env.SQLITE_PATH ?? "data/clipwave.db",
  storageDir: process.env.STORAGE_DIR ?? "data/storage",

  /** Auth */
  sessionSecret: process.env.SESSION_SECRET ?? "dev-only-insecure-secret-change-me",
  sessionTtlDays: num(process.env.SESSION_TTL_DAYS, 30),
  googleClientId: process.env.GOOGLE_CLIENT_ID ?? "",
  googleClientSecret: process.env.GOOGLE_CLIENT_SECRET ?? "",
  adminEmail: process.env.ADMIN_EMAIL ?? "admin@clipwave.app",
  adminPassword: process.env.ADMIN_PASSWORD ?? "clipwave-admin",

  /** Media acquisition */
  ytdlpPath: process.env.YTDLP_PATH ?? "yt-dlp",
  ffmpegPath: process.env.FFMPEG_PATH ?? "ffmpeg",
  ffprobePath: process.env.FFPROBE_PATH ?? "ffprobe",
  allowRemoteFetch: bool(process.env.ALLOW_REMOTE_FETCH, true),
  maxSourceSeconds: num(process.env.MAX_SOURCE_SECONDS, 3 * 60 * 60),
  cookiesFile: process.env.YTDLP_COOKIES_FILE ?? "",
  proxyUrl: process.env.YTDLP_PROXY ?? "",

  /** Speech to text: local (faster-whisper) | openai | none */
  sttProvider: (process.env.STT_PROVIDER ?? "local") as "local" | "openai" | "none",
  whisperModel: process.env.WHISPER_MODEL ?? "small",
  whisperDevice: process.env.WHISPER_DEVICE ?? "cpu",
  whisperComputeType: process.env.WHISPER_COMPUTE_TYPE ?? "int8",
  pythonBin: process.env.PYTHON_BIN ?? "python3",

  /** LLM for clip ranking + SEO (any OpenAI-compatible endpoint) */
  llmApiKey: process.env.LLM_API_KEY ?? process.env.OPENAI_API_KEY ?? "",
  llmBaseUrl: process.env.LLM_BASE_URL ?? "https://api.openai.com/v1",
  llmModel: process.env.LLM_MODEL ?? "gpt-4o-mini",
  openaiApiKey: process.env.OPENAI_API_KEY ?? "",

  workerConcurrency: num(process.env.WORKER_CONCURRENCY, 1),
  workerPollMs: num(process.env.WORKER_POLL_MS, 1500),
  maxUploadBytes: num(process.env.MAX_UPLOAD_BYTES, 2 * 1024 * 1024 * 1024),

  emailFrom: process.env.EMAIL_FROM ?? "Clipwave <noreply@clipwave.app>",
  smtpUrl: process.env.SMTP_URL ?? "",
};

export const llmEnabled = Boolean(env.llmApiKey);
export const isProd = env.nodeEnv === "production";
