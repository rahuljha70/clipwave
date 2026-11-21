/**
 * Source resolution: platform detection, metadata lookup and authorized media
 * acquisition.
 *
 * Policy: we only fetch media that is publicly available to the requester and
 * that the platform exposes without DRM circumvention. Private, age-gated,
 * members-only, paywalled or DRM-protected media is rejected with a clear
 * message. Users can always upload their own file instead (POST /api/upload).
 */
import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { env } from "../env";
import { ensureYtDlpAvailable } from "./ytdlp";

export type Platform = "youtube" | "kick" | "upload";

export interface SourceMeta {
  platform: Platform;
  sourceId: string;
  url: string;
  title: string;
  channel: string | null;
  description?: string | null;
  thumbnailUrl: string | null;
  durationSec: number;
  isLive: boolean;
  isDownloadable: boolean;
  viewCount?: number | null;
  publishedAt?: string | null;
}

export class SourceError extends Error {
  code:
    | "invalid_url"
    | "unsupported"
    | "private"
    | "unavailable"
    | "live"
    | "duration"
    | "fetch_failed"
    | "tool_missing";
  constructor(code: SourceError["code"], message: string) {
    super(message);
    this.code = code;
  }
}

/* ----------------------------- URL detection ------------------------------ */

const YT_PATTERNS = [
  /(?:^|\/\/)(?:www\.|m\.|music\.)?youtube\.com\/watch\?(?:.*&)?v=([\w-]{6,})/i,
  /(?:^|\/\/)(?:www\.)?youtube\.com\/(?:live|shorts|embed)\/([\w-]{6,})/i,
  /(?:^|\/\/)youtu\.be\/([\w-]{6,})/i,
];
const KICK_PATTERNS = [
  /(?:^|\/\/)(?:www\.)?kick\.com\/video\/([\w-]+)/i,
  /(?:^|\/\/)(?:www\.)?kick\.com\/([\w.-]+)\?(?:.*&)?video=([\w-]+)/i,
  /(?:^|\/\/)(?:www\.)?kick\.com\/([\w.-]+)\/videos\/([\w-]+)/i,
];

export interface DetectedSource {
  platform: Platform;
  sourceId: string;
  url: string;
  channelHint?: string;
}

export function detectPlatform(rawUrl: string): DetectedSource {
  const url = rawUrl.trim();
  if (!url) throw new SourceError("invalid_url", "Paste a video link to get started.");
  if (!/^https?:\/\//i.test(url)) {
    if (/^[\w-]{11}$/.test(url)) {
      // Bare YouTube video id
      return {
        platform: "youtube",
        sourceId: url,
        url: `https://www.youtube.com/watch?v=${url}`,
      };
    }
    throw new SourceError("invalid_url", "That does not look like a valid URL.");
  }
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    throw new SourceError("invalid_url", "That does not look like a valid URL.");
  }

  for (const pattern of YT_PATTERNS) {
    const match = url.match(pattern);
    if (match) return { platform: "youtube", sourceId: match[1], url };
  }
  for (const pattern of KICK_PATTERNS) {
    const match = url.match(pattern);
    if (match) {
      const id = match[2] ?? match[1];
      return { platform: "kick", sourceId: id, url, channelHint: match[2] ? match[1] : undefined };
    }
  }
  if (/(?:^|\.)kick\.com$/i.test(parsed.hostname)) {
    throw new SourceError(
      "unsupported",
      "That Kick link is a live channel page. Open the channel's past broadcast and copy the VOD link (kick.com/video/…).",
    );
  }
  if (/(?:^|\.)youtube\.com$/i.test(parsed.hostname) && parsed.pathname === "/") {
    throw new SourceError("unsupported", "Paste a specific YouTube video or /live/ link.");
  }
  throw new SourceError(
    "unsupported",
    "Clipwave imports YouTube and Kick links. For other platforms, upload the file directly.",
  );
}

/* ------------------------------- yt-dlp ----------------------------------- */

export function runTool(
  bin: string,
  args: string[],
  opts: { timeoutMs?: number; cwd?: string } = {},
): Promise<{ code: number; stdout: string; stderr: string }> {
  return new Promise((resolve, reject) => {
    const child = spawn(bin, args, { cwd: opts.cwd, env: process.env });
    let stdout = "";
    let stderr = "";
    const timer = setTimeout(() => {
      child.kill("SIGKILL");
      reject(new Error(`${bin} timed out`));
    }, opts.timeoutMs ?? 120_000);
    child.stdout.on("data", (d) => (stdout += d.toString()));
    child.stderr.on("data", (d) => (stderr += d.toString()));
    child.on("error", (err: NodeJS.ErrnoException) => {
      clearTimeout(timer);
      if (err.code === "ENOENT") {
        reject(
          new SourceError(
            "tool_missing",
            `${bin} could not be started. Run npm run setup:ytdlp or upload a video file instead.`,
          ),
        );
      } else reject(err);
    });
    child.on("close", (code) => {
      clearTimeout(timer);
      resolve({ code: code ?? 1, stdout, stderr });
    });
  });
}

function ytdlpArgs(): string[] {
  const args: string[] = ["--no-playlist", "--no-warnings", "--ignore-config"];
  const ffmpegPath = env.ffmpegPath.trim();
  if (ffmpegPath && !["ffmpeg", "ffmpeg.exe"].includes(path.basename(ffmpegPath).toLowerCase())) {
    args.push("--ffmpeg-location", ffmpegPath);
  }
  if (env.cookiesFile) args.push("--cookies", env.cookiesFile);
  if (env.proxyUrl) args.push("--proxy", env.proxyUrl);
  return args;
}

function assertVideoReady(info: any, platform: "YouTube" | "Kick"): void {
  const status = typeof info?.live_status === "string" ? info.live_status : null;

  // `was_live` is an archived replay and should go through the same clip pipeline as a regular video.
  if (status === "was_live" || status === "not_live") return;
  if (status === "is_upcoming") {
    throw new SourceError("live", `This ${platform} broadcast has not started yet. Import its replay after it ends.`);
  }
  if (status === "post_live") {
    throw new SourceError(
      "live",
      `This ${platform} broadcast ended, but its replay is still being prepared. Try again once the replay is available.`,
    );
  }
  if (status === "is_live" || info?.is_live) {
    throw new SourceError("live", `This ${platform} stream is live right now. Import its replay after the broadcast ends.`);
  }
}

function mapYtdlpError(stderr: string): SourceError {
  const s = stderr.toLowerCase();
  if (
    /unable to download (?:api page|webpage)|failed to establish a new connection|temporary failure in name resolution|network is unreachable|connection (?:timed out|refused|reset)|winerror\s*10013/.test(
      s,
    )
  ) {
    return new SourceError(
      "fetch_failed",
      "Clipwave could not connect to YouTube from this server. Check the server's internet, DNS or firewall access, then retry.",
    );
  }
  if (s.includes("private video") || s.includes("this video is private"))
    return new SourceError(
      "private",
      "This video is private. Only public or unlisted videos can be imported — or upload the file you own.",
    );
  if (s.includes("members-only") || s.includes("join this channel"))
    return new SourceError("private", "This video is members-only and cannot be imported.");
  if (s.includes("age") && (s.includes("confirm") || s.includes("restricted")))
    return new SourceError("private", "This video is age-restricted, so it cannot be imported.");
  if (s.includes("confirm you") && s.includes("not a bot"))
    return new SourceError(
      "fetch_failed",
      "YouTube is asking this server to verify it is not a bot. Add a cookies file (YTDLP_COOKIES_FILE) or a residential proxy (YTDLP_PROXY) in the environment, or upload the file you own instead.",
    );
  if (s.includes("sign in") || s.includes("login required"))
    return new SourceError("private", "This video requires sign-in and cannot be imported.");
  if (s.includes("video unavailable") || s.includes("has been removed") || s.includes("404"))
    return new SourceError("unavailable", "This video is unavailable or has been deleted.");
  if (s.includes("is live") || s.includes("live event"))
    return new SourceError(
      "live",
      "This stream is still live. Import it once the broadcast ends and the VOD is available.",
    );
  if (s.includes("unsupported url"))
    return new SourceError("unsupported", "This link is not supported yet.");
  return new SourceError("fetch_failed", "We could not read this video. Check the link and retry.");
}

/* --------------------------- metadata providers --------------------------- */

async function youtubeOEmbed(id: string) {
  try {
    const res = await fetch(
      `https://www.youtube.com/oembed?url=${encodeURIComponent(
        `https://www.youtube.com/watch?v=${id}`,
      )}&format=json`,
      { signal: AbortSignal.timeout(8000), headers: { accept: "application/json" } },
    );
    if (res.ok) {
      const data: any = await res.json();
      return {
        title: String(data.title ?? "YouTube video"),
        channel: data.author_name ? String(data.author_name) : null,
        thumbnailUrl: `https://i.ytimg.com/vi/${id}/hqdefault.jpg`,
      };
    }
    if (res.status === 401 || res.status === 403)
      throw new SourceError("private", "This YouTube video is private or restricted.");
    if (res.status === 404)
      throw new SourceError("unavailable", "This YouTube video is unavailable or has been deleted.");
  } catch (err) {
    if (err instanceof SourceError) throw err;
  }
  return { title: null, channel: null, thumbnailUrl: `https://i.ytimg.com/vi/${id}/hqdefault.jpg` };
}

async function ytdlpJson(url: string): Promise<any | null> {
  let binary: string;
  try {
    binary = await ensureYtDlpAvailable();
  } catch (error) {
    throw new SourceError(
      "tool_missing",
      error instanceof Error ? error.message : "yt-dlp could not be set up.",
    );
  }
  const { code, stdout, stderr } = await runTool(
    binary,
    [...ytdlpArgs(), "--dump-single-json", "--skip-download", url],
    { timeoutMs: 60_000 },
  ).catch(() => ({ code: 1, stdout: "", stderr: "" }) as any);
  if (code !== 0 || !stdout.trim()) {
    if (
      stderr &&
      /private|unavailable|members|age|live|unable to download|failed to establish|name resolution|network is unreachable|connection (?:timed out|refused|reset)|winerror\s*10013/i.test(
        stderr,
      )
    ) {
      throw mapYtdlpError(stderr);
    }
    return null;
  }
  try {
    return JSON.parse(stdout);
  } catch {
    return null;
  }
}

export async function resolveSource(rawUrl: string): Promise<SourceMeta> {
  const detected = detectPlatform(rawUrl);

  if (detected.platform === "youtube") {
    const [oembed, info] = await Promise.all([
      youtubeOEmbed(detected.sourceId),
      ytdlpJson(detected.url),
    ]);
    assertVideoReady(info, "YouTube");
    const duration = Number(info?.duration ?? 0);
    return {
      platform: "youtube",
      sourceId: detected.sourceId,
      url: detected.url,
      title: String(info?.title ?? oembed.title ?? "YouTube video"),
      channel: info?.uploader ?? info?.channel ?? oembed.channel ?? null,
      description: info?.description ? String(info.description).slice(0, 5000) : null,
      thumbnailUrl: info?.thumbnail ?? oembed.thumbnailUrl ?? null,
      durationSec: duration,
      isLive: false,
      isDownloadable: true,
      viewCount: info?.view_count ?? null,
      publishedAt: info?.upload_date ? String(info.upload_date) : null,
    };
  }

  if (detected.platform === "kick") {
    let apiData: any = null;
    try {
      const res = await fetch(`https://kick.com/api/v2/videos/${detected.sourceId}`, {
        signal: AbortSignal.timeout(10_000),
        headers: {
          accept: "application/json",
          "user-agent":
            "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36",
        },
      });
      if (res.ok) apiData = await res.json();
      else if (res.status === 404)
        throw new SourceError("unavailable", "This Kick VOD no longer exists.");
    } catch (err) {
      if (err instanceof SourceError) throw err;
    }

    const info = await ytdlpJson(detected.url);
    if (!apiData && !info) {
      throw new SourceError(
        "unavailable",
        "We could not read this Kick VOD. It may be deleted, subscribers-only, or expired.",
      );
    }
    assertVideoReady(info, "Kick");
    const duration = Number(
      info?.duration ??
        apiData?.duration ??
        (apiData?.start_time && apiData?.end_time
          ? (new Date(apiData.end_time).getTime() - new Date(apiData.start_time).getTime()) / 1000
          : 0),
    );
    return {
      platform: "kick",
      sourceId: detected.sourceId,
      url: detected.url,
      title: String(
        apiData?.session_title ?? info?.title ?? `Kick VOD ${detected.sourceId}`,
      ).slice(0, 300),
      channel: apiData?.channel?.slug ?? info?.uploader ?? detected.channelHint ?? null,
      description: null,
      thumbnailUrl: apiData?.thumbnail?.src ?? apiData?.thumbnail?.url ?? info?.thumbnail ?? null,
      durationSec: Number.isFinite(duration) ? duration : 0,
      isLive: Boolean(info?.is_live),
      isDownloadable: true,
      viewCount: apiData?.views ?? null,
      publishedAt: apiData?.created_at ?? null,
    };
  }

  throw new SourceError("unsupported", "Unsupported source.");
}

/* --------------------------- media acquisition ---------------------------- */

export interface DownloadResult {
  filePath: string;
  bytes: number;
}

/**
 * Downloads the media for a resolved source into `targetDir` (mp4, ≤1080p).
 * Only called for public, non-DRM sources that passed resolveSource().
 */
export async function downloadSource(
  source: SourceMeta,
  targetDir: string,
  onProgress?: (percent: number, label: string) => void,
): Promise<DownloadResult> {
  if (!env.allowRemoteFetch) {
    throw new SourceError(
      "fetch_failed",
      "Remote fetching is disabled on this deployment. Upload a video file instead.",
    );
  }
  fs.mkdirSync(targetDir, { recursive: true });
  const outTemplate = path.join(targetDir, "source.%(ext)s");
  let binary: string;
  try {
    binary = await ensureYtDlpAvailable();
  } catch (error) {
    throw new SourceError(
      "tool_missing",
      error instanceof Error ? error.message : "yt-dlp could not be set up.",
    );
  }
  const args = [
    ...ytdlpArgs(),
    "-f",
    "bv*[height<=1080][ext=mp4]+ba[ext=m4a]/b[height<=1080][ext=mp4]/b[height<=1080]/b",
    "--merge-output-format",
    "mp4",
    "--no-part",
    "--newline",
    "--progress",
    "--retries",
    "3",
    "--concurrent-fragments",
    "4",
    "-o",
    outTemplate,
    source.url,
  ];

  const result = await new Promise<{ code: number; stderr: string }>((resolve, reject) => {
    const child = spawn(binary, args, { env: process.env });
    let stderr = "";
    child.stdout.on("data", (chunk) => {
      const text = chunk.toString();
      const match = text.match(/\[download\]\s+([\d.]+)%/);
      if (match && onProgress) onProgress(Math.round(Number(match[1])), "Downloading source video");
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
    });
    child.on("error", (err: NodeJS.ErrnoException) => {
      reject(
        err.code === "ENOENT"
          ? new SourceError("tool_missing", "yt-dlp is not installed on the server (see README).")
          : err,
      );
    });
    child.on("close", (code) => resolve({ code: code ?? 1, stderr }));
  });

  if (result.code !== 0) throw mapYtdlpError(result.stderr);

  const files = fs.readdirSync(targetDir).filter((f) => f.startsWith("source."));
  const mergedFile = files.find((f) => f.toLowerCase() === "source.mp4");
  if (!mergedFile) {
    const videoFile = files.find((f) => /\.(mp4|mkv|webm|mov)$/i.test(f));
    const audioFile = files.find((f) => /\.(m4a|aac|mp3|opus|weba|wav|mka)$/i.test(f));
    if (videoFile && audioFile) {
      throw new SourceError(
        "fetch_failed",
        "yt-dlp downloaded separate video and audio streams but could not merge them. Check FFMPEG_PATH and retry.",
      );
    }
  }
  const mediaFile = mergedFile ?? files.find((f) => /\.(mp4|mkv|webm|mov)$/i.test(f));
  if (!mediaFile) throw new SourceError("fetch_failed", "Download finished but no media file was produced.");
  const filePath = path.join(targetDir, mediaFile);
  return { filePath, bytes: fs.statSync(filePath).size };
}
