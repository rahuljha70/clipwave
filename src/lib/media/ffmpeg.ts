/**
 * FFmpeg / ffprobe helpers: probing, audio extraction, frame capture,
 * smart-cropped rendering and thumbnail export.
 */
import { spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { env } from "../env";

export interface RunResult {
  code: number;
  stdout: string;
  stderr: string;
}

export function run(
  bin: string,
  args: string[],
  opts: { cwd?: string; timeoutMs?: number } = {},
): Promise<RunResult> {
  return new Promise((resolve, reject) => {
    const child = spawn(bin, args, { cwd: opts.cwd, env: process.env });
    let stdout = "";
    let stderr = "";
    const timer = setTimeout(() => {
      child.kill("SIGKILL");
      reject(new Error(`${bin} timed out after ${opts.timeoutMs ?? 600000}ms`));
    }, opts.timeoutMs ?? 600_000);
    child.stdout.on("data", (d) => (stdout += d.toString()));
    child.stderr.on("data", (d) => (stderr += d.toString()));
    child.on("error", (err: NodeJS.ErrnoException) => {
      clearTimeout(timer);
      reject(
        new Error(
          err.code === "ENOENT"
            ? `${bin} is not installed. Install FFmpeg and set FFMPEG_PATH (see README).`
            : err.message,
        ),
      );
    });
    child.on("close", (code) => {
      clearTimeout(timer);
      resolve({ code: code ?? 1, stdout, stderr });
    });
  });
}

async function ffmpegOk(): Promise<boolean> {
  try {
    const { code } = await run(env.ffmpegPath, ["-version"], { timeoutMs: 10_000 });
    return code === 0;
  } catch {
    return false;
  }
}

export async function requireFfmpeg() {
  if (!(await ffmpegOk())) {
    throw new Error(
      "FFmpeg is not available on this server. Install FFmpeg (see README) to render clips.",
    );
  }
}

export interface ProbeInfo {
  durationSec: number;
  width: number;
  height: number;
  fps: number;
  hasAudio: boolean;
  videoCodec: string | null;
  audioCodec: string | null;
  bitrate: number | null;
  rotation: number;
}

export async function probe(file: string): Promise<ProbeInfo> {
  const { code, stdout, stderr } = await run(
    env.ffprobePath,
    ["-v", "error", "-print_format", "json", "-show_format", "-show_streams", file],
    { timeoutMs: 60_000 },
  );
  if (code !== 0) throw new Error(`ffprobe failed: ${stderr.slice(-400)}`);
  const data = JSON.parse(stdout) as {
    format?: { duration?: string; bit_rate?: string };
    streams?: Array<{
      codec_type?: string;
      duration?: string;
      avg_frame_rate?: string;
      width?: number;
      height?: number;
      codec_name?: string;
      tags?: { rotate?: string };
      side_data_list?: Array<{ rotation?: number }>;
    }>;
  };
  const streams = data.streams ?? [];
  const video = streams.find((s) => s.codec_type === "video");
  const audio = streams.find((s) => s.codec_type === "audio");
  const duration = Number(data.format?.duration ?? video?.duration ?? 0);
  const fps = video?.avg_frame_rate ? evalFps(video.avg_frame_rate) : 30;
  const rotation = Number(video?.tags?.rotate ?? video?.side_data_list?.[0]?.rotation ?? 0);
  return {
    durationSec: Number.isFinite(duration) ? duration : 0,
    width: Number(video?.width ?? 0),
    height: Number(video?.height ?? 0),
    fps: fps || 30,
    hasAudio: Boolean(audio),
    videoCodec: video?.codec_name ?? null,
    audioCodec: audio?.codec_name ?? null,
    bitrate: data.format?.bit_rate ? Number(data.format.bit_rate) : null,
    rotation,
  };
}

/** Copy the source video and a separately downloaded audio stream into one MP4. */
export async function muxAudioVideo(videoPath: string, audioPath: string, outputPath: string): Promise<void> {
  await requireFfmpeg();
  const tempPath = `${outputPath}.${randomUUID()}.tmp.mp4`;
  try {
    const { code, stderr } = await run(
      env.ffmpegPath,
      [
        "-hide_banner",
        "-loglevel",
        "error",
        "-y",
        "-i",
        videoPath,
        "-i",
        audioPath,
        "-map",
        "0:v:0",
        "-map",
        "1:a:0",
        "-c",
        "copy",
        "-movflags",
        "+faststart",
        tempPath,
      ],
      { timeoutMs: 600_000 },
    );
    if (code !== 0) throw new Error(`FFmpeg could not merge the audio stream: ${stderr.slice(-500)}`);
    if (fs.existsSync(outputPath)) fs.rmSync(outputPath, { force: true });
    fs.renameSync(tempPath, outputPath);
  } finally {
    if (fs.existsSync(tempPath)) fs.rmSync(tempPath, { force: true });
  }
}

function evalFps(rate: string): number {
  const [n, d] = rate.split("/").map(Number);
  if (!d) return n || 30;
  return Math.round((n / d) * 100) / 100;
}

/** Extract mono 16 kHz WAV (for STT) and raw float32 PCM (for feature analysis). */
export async function extractAudio(
  input: string,
  outWav: string,
  opts: { startSec?: number; durationSec?: number } = {},
) {
  const args = ["-hide_banner", "-loglevel", "error", "-y"];
  if (opts.startSec) args.push("-ss", String(opts.startSec));
  if (opts.durationSec) args.push("-t", String(opts.durationSec));
  args.push("-i", input, "-vn", "-ac", "1", "-ar", "16000", "-c:a", "pcm_s16le", outWav);
  const res = await run(env.ffmpegPath, args);
  if (res.code !== 0) throw new Error(`audio extraction failed: ${res.stderr.slice(-400)}`);
  return outWav;
}

export async function extractAudioF32(input: string, outRaw: string) {
  const res = await run(env.ffmpegPath, [
    "-hide_banner",
    "-loglevel",
    "error",
    "-y",
    "-i",
    input,
    "-vn",
    "-ac",
    "1",
    "-ar",
    "16000",
    "-f",
    "f32le",
    outRaw,
  ]);
  if (res.code !== 0) throw new Error(`audio decode failed: ${res.stderr.slice(-400)}`);
  return outRaw;
}

/** Grab evenly-spaced frames as JPEGs — used for thumbnails and face tracking. */
export async function captureFrames(
  input: string,
  outDir: string,
  opts: { times: number[]; width?: number; startSec?: number },
) {
  fs.mkdirSync(outDir, { recursive: true });
  const width = opts.width ?? 640;
  const files: string[] = [];
  for (const t of opts.times) {
    const out = path.join(outDir, `frame-${t.toFixed(2).replace(".", "_")}.jpg`);
    const res = await run(env.ffmpegPath, [
      "-hide_banner",
      "-loglevel",
      "error",
      "-y",
      "-ss",
      String(Math.max(0, (opts.startSec ?? 0) + t)),
      "-i",
      input,
      "-frames:v",
      "1",
      "-vf",
      `scale=${width}:-2`,
      "-q:v",
      "3",
      out,
    ]);
    if (res.code === 0 && fs.existsSync(out)) files.push(out);
  }
  return files;
}

/** Sample frames at a fixed interval across a time range. */
export async function captureFramesEvery(
  input: string,
  outDir: string,
  opts: { startSec: number; durationSec: number; everySec: number; width?: number },
) {
  fs.mkdirSync(outDir, { recursive: true });
  const width = opts.width ?? 480;
  const res = await run(env.ffmpegPath, [
    "-hide_banner",
    "-loglevel",
    "error",
    "-y",
    "-ss",
    String(opts.startSec),
    "-t",
    String(opts.durationSec),
    "-i",
    input,
    "-vf",
    `fps=1/${opts.everySec},scale=${width}:-2`,
    "-q:v",
    "4",
    path.join(outDir, "f-%04d.jpg"),
  ]);
  if (res.code !== 0) return [];
  return fs
    .readdirSync(outDir)
    .filter((f) => f.endsWith(".jpg"))
    .sort()
    .map((f) => path.join(outDir, f));
}

/* ------------------------------- rendering -------------------------------- */

export interface CropPoint {
  t: number;
  x: number;
}

/**
 * `shortSide` is the plan's resolution (720/1080) and always maps to the
 * smaller dimension: 1080 -> 1080x1920 vertical, 1920x1080 landscape, 1080x1080.
 */
export function resolutionFor(aspect: string, shortSide: number): { w: number; h: number } {
  const even = (n: number) => Math.round(n / 2) * 2;
  if (aspect === "16:9") return { w: even((shortSide * 16) / 9), h: shortSide };
  if (aspect === "1:1") return { w: shortSide, h: shortSide };
  return { w: shortSide, h: even((shortSide * 16) / 9) };
}

/**
 * Turns a smoothed list of crop centres into an ffmpeg expression that pans
 * linearly between segments (piecewise linear, clamped to the frame).
 */
export function cropExpression(points: CropPoint[], clipDuration: number): string {
  const pts = [...points]
    .filter((p) => Number.isFinite(p.t) && Number.isFinite(p.x))
    .map((point) => ({ ...point, t: Math.max(0, Math.min(clipDuration, point.t)) }))
    .sort((a, b) => a.t - b.t);
  if (pts.length === 0) return "(iw-ow)/2";
  if (pts.length === 1) return `min(max(0,${pts[0].x.toFixed(1)}),iw-ow)`;

  let expr = `min(max(0,${pts[pts.length - 1].x.toFixed(1)}),iw-ow)`;
  for (let i = pts.length - 2; i >= 0; i--) {
    const a = pts[i];
    const b = pts[i + 1];
    const span = Math.max(0.001, b.t - a.t);
    const lerp = `${a.x.toFixed(1)}+(${b.x.toFixed(1)}-${a.x.toFixed(1)})*(t-${a.t.toFixed(
      2,
    )})/${span.toFixed(3)}`;
    expr = `if(lt(t,${b.t.toFixed(2)}),min(max(0,${lerp}),iw-ow),${expr})`;
  }
  return expr;
}

export function assFilterName(fileName = "subs.ass"): string {
  // Relative filename + cwd avoids cross-platform escaping issues.
  return `ass=${fileName}`;
}

export interface RenderOptions {
  input: string;
  output: string;
  cwd: string;
  startSec: number;
  durationSec: number;
  aspect: "9:16" | "16:9" | "1:1" | string;
  height: 720 | 1080;
  fps: 30 | 60;
  cropMode: "face" | "center" | "blur";
  cropPath?: CropPoint[];
  subtitleFile?: string | null;
  watermark?: boolean;
  music?: { file: string; volume: number } | null;
  speed?: number;
  overlayText?: { text: string; position: "top" | "bottom"; startSec: number; endSec: number } | null;
  introPath?: string | null;
  outroPath?: string | null;
  onProgress?: (percent: number) => void;
}

/**
 * Cuts + reframes + burns subtitles in a single pass.
 * Everything runs with cwd = clip folder so filter paths stay relative.
 */
export async function renderClip(opts: RenderOptions): Promise<string> {
  await requireFfmpeg();
  const { w, h } = resolutionFor(opts.aspect, opts.height);
  const speed = opts.speed && opts.speed > 0 ? opts.speed : 1;
  const filters: string[] = [];
  const args: string[] = ["-hide_banner", "-loglevel", "error", "-y"];
  args.push("-ss", String(opts.startSec), "-t", String(opts.durationSec), "-i", opts.input);

  if (opts.music) args.push("-stream_loop", "-1", "-i", opts.music.file);
  if (opts.introPath) args.push("-i", opts.introPath);
  if (opts.outroPath) args.push("-i", opts.outroPath);

  const watermarkText = "Clipwave";
  let videoLabel = "0:v";

  if (opts.cropMode === "blur") {
    // Split: blurred background fill + centred foreground.
    filters.push(
      `[0:v]split=2[bg][fg];` +
        `[bg]scale=${w}:${h}:force_original_aspect_ratio=increase,crop=${w}:${h},boxblur=40:2,eq=brightness=-0.12[bgv];` +
        `[fg]scale=${w}:${h}:force_original_aspect_ratio=decrease[fgs];` +
        `[bgv][fgs]overlay=(W-w)/2:(H-h)/2[base]`,
    );
    videoLabel = "base";
  } else {
    const xExpr =
      opts.cropMode === "face" && opts.cropPath && opts.cropPath.length > 0
        ? cropExpression(opts.cropPath, opts.durationSec)
        : "(iw-ow)/2";
    if (opts.aspect === "9:16") {
      filters.push(
        `[0:v]scale=-2:${h}:flags=lanczos,crop=${w}:${h}:x='${xExpr}':y=0[base]`,
      );
    } else if (opts.aspect === "1:1") {
      filters.push(
        `[0:v]scale=${w}:${h}:force_original_aspect_ratio=increase,crop=${w}:${h}:(iw-ow)/2:(ih-oh)/2[base]`,
      );
    } else {
      filters.push(
        `[0:v]scale=${w}:${h}:force_original_aspect_ratio=increase,crop=${w}:${h}:(iw-ow)/2:(ih-oh)/2[base]`,
      );
    }
    videoLabel = "base";
  }

  const chain: string[] = [];
  if (speed !== 1) chain.push(`setpts=${(1 / speed).toFixed(4)}*PTS`);
  chain.push(`fps=${opts.fps}`);
  chain.push("format=yuv420p");

  if (opts.subtitleFile) chain.push(assFilterName(opts.subtitleFile));

  if (opts.watermark) {
    chain.push(
      `drawtext=text='${watermarkText}':fontcolor=white@0.55:fontsize=${Math.round(
        h * 0.028,
      )}:fontfile=/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf:x=w-tw-24:y=h-th-24`,
    );
  }

  if (opts.overlayText && opts.overlayText.text) {
    const safe = opts.overlayText.text.replace(/[:'\\]/g, " ").slice(0, 80);
    const y = opts.overlayText.position === "top" ? Math.round(h * 0.08) : Math.round(h * 0.82);
    chain.push(
      `drawtext=text='${safe}':fontcolor=white:fontsize=${Math.round(
        h * 0.045,
      )}:fontfile=/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf:x=(w-tw)/2:y=${y}:box=1:boxcolor=black@0.35:boxborderw=14:enable='between(t,${opts.overlayText.startSec},${opts.overlayText.endSec})'`,
    );
  }

  filters.push(`[${videoLabel}]${chain.join(",")}[vout]`);

  let audioMap: string | null = "0:a?";
  if (opts.music) {
    const musicIdx = 1;
    filters.push(
      `[${musicIdx}:a]volume=${opts.music.volume.toFixed(2)},atrim=0:${opts.durationSec}[m]`,
    );
    if (speed !== 1) {
      filters.push(`[0:a]atempo=${Math.min(2, Math.max(0.5, speed)).toFixed(2)}[a0]`);
      filters.push(`[a0][m]amix=inputs=2:duration=first:dropout_transition=0[aout]`);
    } else {
      filters.push(`[0:a][m]amix=inputs=2:duration=first:dropout_transition=0[aout]`);
    }
    audioMap = "[aout]";
  } else if (speed !== 1) {
    filters.push(
      `[0:a]atempo=${Math.min(2, Math.max(0.5, speed)).toFixed(2)}[aout]`,
    );
    audioMap = "[aout]";
  }

  args.push("-filter_complex", filters.join(";"));
  args.push("-map", "[vout]");
  if (audioMap) args.push("-map", audioMap);
  args.push(
    "-c:v",
    "libx264",
    "-preset",
    "veryfast",
    "-crf",
    "20",
    "-profile:v",
    "high",
    "-pix_fmt",
    "yuv420p",
    "-c:a",
    "aac",
    "-b:a",
    "160k",
    "-ac",
    "2",
    "-movflags",
    "+faststart",
    "-shortest",
    opts.output,
  );

  const res = await new Promise<RunResult>((resolve, reject) => {
    const child = spawn(env.ffmpegPath, args, { cwd: opts.cwd, env: process.env });
    let stderr = "";
    let lastLine = "";
    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
      const lines = stderr.split(/\r?\n/).filter(Boolean);
      lastLine = lines[lines.length - 1] ?? "";
      const m = lastLine.match(/time=(\d+):(\d+):(\d+)\.(\d+)/);
      if (m && opts.onProgress && opts.durationSec > 0) {
        const seconds = Number(m[1]) * 3600 + Number(m[2]) * 60 + Number(m[3]) + Number(`0.${m[4]}`);
        opts.onProgress(Math.min(99, Math.round((seconds / opts.durationSec) * 100)));
      }
    });
    child.on("error", reject);
    child.on("close", (code) => resolve({ code: code ?? 1, stdout: "", stderr }));
  });

  if (res.code !== 0) {
    throw new Error(`Render failed: ${res.stderr.split("\n").slice(-6).join(" ").slice(0, 700)}`);
  }
  return opts.output;
}

/** Render a short branded intro/outro card used by the editor. */
export async function renderBrandCard(opts: {
  output: string;
  cwd: string;
  text: string;
  subtitle?: string;
  width: number;
  height: number;
  seconds: number;
  background?: string;
}) {
  const filter = [
    `drawtext=text='${opts.text.replace(/[:'\\]/g, " ")}':fontcolor=white:fontsize=${Math.round(
      opts.height * 0.075,
    )}:fontfile=/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf:x=(w-tw)/2:y=(h-th)/2-40`,
    opts.subtitle
      ? `drawtext=text='${opts.subtitle.replace(/[:'\\]/g, " ")}':fontcolor=white@0.75:fontsize=${Math.round(
          opts.height * 0.032,
        )}:fontfile=/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf:x=(w-tw)/2:y=(h-th)/2+60`
      : null,
  ]
    .filter(Boolean)
    .join(",");

  const res = await run(
    env.ffmpegPath,
    [
      "-hide_banner",
      "-loglevel",
      "error",
      "-y",
      "-f",
      "lavfi",
      "-i",
      `color=c=${opts.background ?? "0x0B0B14"}:s=${opts.width}x${opts.height}:d=${opts.seconds}:r=30`,
      "-f",
      "lavfi",
      "-i",
      `anullsrc=channel_layout=stereo:sample_rate=44100`,
      "-vf",
      filter,
      "-t",
      String(opts.seconds),
      "-c:v",
      "libx264",
      "-preset",
      "veryfast",
      "-crf",
      "20",
      "-pix_fmt",
      "yuv420p",
      "-c:a",
      "aac",
      "-shortest",
      opts.output,
    ],
    { cwd: opts.cwd },
  );
  if (res.code !== 0) throw new Error(`Brand card render failed: ${res.stderr.slice(-300)}`);
  return opts.output;
}

/** Concatenate the intro, main clip and outro into one file. */
export async function concatVideos(parts: string[], output: string, cwd: string) {
  const list = `concat-${Date.now()}.txt`;
  fs.writeFileSync(
    path.join(cwd, list),
    parts.map((p) => `file '${p.replace(/'/g, "'\\''")}'`).join("\n"),
  );
  const res = await run(
    env.ffmpegPath,
    [
      "-hide_banner",
      "-loglevel",
      "error",
      "-y",
      "-f",
      "concat",
      "-safe",
      "0",
      "-i",
      list,
      "-c:v",
      "libx264",
      "-preset",
      "veryfast",
      "-crf",
      "20",
      "-pix_fmt",
      "yuv420p",
      "-c:a",
      "aac",
      "-b:a",
      "160k",
      "-movflags",
      "+faststart",
      output,
    ],
    { cwd },
  );
  fs.rmSync(path.join(cwd, list), { force: true });
  if (res.code !== 0) throw new Error(`Concat failed: ${res.stderr.slice(-300)}`);
  return output;
}

/** Converts an mp4 into a looping-friendly web preview (fast start, small). */
export async function makePreview(input: string, output: string, cwd: string) {
  const res = await run(
    env.ffmpegPath,
    [
      "-hide_banner",
      "-loglevel",
      "error",
      "-y",
      "-i",
      input,
      "-vf",
      "scale=-2:720",
      "-c:v",
      "libx264",
      "-preset",
      "veryfast",
      "-crf",
      "26",
      "-c:a",
      "aac",
      "-b:a",
      "96k",
      "-movflags",
      "+faststart",
      output,
    ],
    { cwd },
  );
  if (res.code !== 0) throw new Error(`Preview render failed: ${res.stderr.slice(-300)}`);
  return output;
}

/** Extracts a single still for the thumbnail generator. */
export async function grabStill(
  input: string,
  timeSec: number,
  output: string,
  size = 1280,
): Promise<string> {
  const res = await run(env.ffmpegPath, [
    "-hide_banner",
    "-loglevel",
    "error",
    "-y",
    "-ss",
    String(Math.max(0, timeSec)),
    "-i",
    input,
    "-frames:v",
    "1",
    "-vf",
    `scale=${size}:-2`,
    "-q:v",
    "2",
    output,
  ]);
  if (res.code !== 0) throw new Error(`Still extraction failed: ${res.stderr.slice(-300)}`);
  return output;
}
