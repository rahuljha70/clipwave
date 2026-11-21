import fs from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";
import { forbidden, json, notFound, requireUser, route } from "@/lib/api";
import { nowIso, q1, run, type Row } from "@/lib/db";
import { getEffectivePlan } from "@/lib/plans";
import { recordUsage } from "@/lib/entitlements";
import { absPath, existsRel } from "@/lib/storage";
import { storageClipPath } from "@/lib/paths";
import { serveFile } from "@/lib/http-file";
import { run as ffmpegRun } from "@/lib/media/ffmpeg";

type Ctx = { params: Promise<{ id: string }> };

function slug(input: string): string {
  return (
    input
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 60) || "clip"
  );
}

/** Streams an export: rendered video (any resolution), SRT or thumbnail. */
export const GET = route<Ctx>("clips.download", async (req, ctx) => {
  const { id } = await ctx.params;
  const user = await requireUser();
  const clip = await q1<Row>(`SELECT * FROM clips WHERE id = ?`, [id]);
  if (!clip) throw notFound("Clip not found.");
  if (clip.user_id !== user.id && user.role !== "admin") throw forbidden();
  if (clip.status !== "ready" && clip.status !== "failed") {
    return json({ error: "This clip is still rendering.", code: "rendering" }, 409);
  }

  const url = new URL(req.url);
  // accept both `?kind=video|srt|thumb` and the friendlier `?format=mp4|srt|jpg`
  const requested = (url.searchParams.get("kind") ?? url.searchParams.get("format") ?? "video").toLowerCase();
  const kind =
    requested === "srt" || requested === "subtitles"
      ? "srt"
      : requested === "thumb" || requested === "thumbnail" || requested === "jpg" || requested === "png"
        ? "thumb"
        : "video";
  const resolution = Number(url.searchParams.get("resolution") ?? 1080);
  const plan = getEffectivePlan(user.plan, user.role === "admin");

  if (kind === "srt") {
    if (!clip.srt_path) throw notFound("No subtitle file for this clip.");
    await run(
      `INSERT INTO exports (id, user_id, project_id, clip_id, kind, file_path, size_bytes, label, created_at)
       VALUES (?, ?, ?, ?, 'srt', ?, 0, 'SRT subtitles', ?)`,
      [crypto.randomUUID(), user.id, clip.project_id, id, clip.srt_path, nowIso()],
    );
    return serveFile(req, absPath(String(clip.srt_path)), {
      downloadName: `${slug(clip.title ?? "clip")}.srt`,
    });
  }

  if (kind === "thumb") {
    if (!clip.thumbnail_path) throw notFound("No thumbnail for this clip.");
    return serveFile(req, absPath(String(clip.thumbnail_path)), {
      downloadName: `${slug(clip.title ?? "clip")}-thumbnail.jpg`,
    });
  }

  if (!clip.render_path) throw notFound("This clip has not been rendered yet.");
  if (resolution > plan.maxResolution) {
    return json(
      {
        error: `${resolution}p export requires the ${resolution === 1080 ? "Pro" : "Ultimate"} plan. Your plan exports up to ${plan.maxResolution}p.`,
        code: "upgrade",
      },
      402,
    );
  }

  let rel = String(clip.render_path);
  let abs = absPath(rel);

  if (resolution <= 720) {
    const sourceRel = rel;
    const dir = path.dirname(sourceRel);
    const targetRel = path.join(dir, "clip-720.mp4").split(path.sep).join("/");
    if (!(await existsRel(targetRel))) {
      const res = await ffmpegRun(
        process.env.FFMPEG_PATH ?? "ffmpeg",
        [
          "-hide_banner",
          "-loglevel",
          "error",
          "-y",
          "-i",
          abs,
          "-vf",
          "scale=-2:720",
          "-c:v",
          "libx264",
          "-preset",
          "veryfast",
          "-crf",
          "23",
          "-c:a",
          "copy",
          "-movflags",
          "+faststart",
          absPath(targetRel),
        ],
        { timeoutMs: 600_000 },
      );
      if (res.code !== 0) throw new Error(`720p transcode failed: ${res.stderr.slice(-300)}`);
    }
    rel = targetRel;
    abs = absPath(targetRel);
  }

  const stat = await fs.stat(abs);
  await run(
    `INSERT INTO exports (id, user_id, project_id, clip_id, kind, aspect, resolution, fps, file_path, size_bytes, label, created_at)
     VALUES (?, ?, ?, ?, 'video', ?, ?, ?, ?, ?, ?, ?)`,
    [
      crypto.randomUUID(),
      user.id,
      clip.project_id,
      id,
      clip.aspect ?? null,
      `${resolution}p`,
      plan.maxFps,
      rel,
      stat.size,
      clip.title ?? "Clip",
      nowIso(),
    ],
  );
  await recordUsage({ userId: user.id, kind: "export", clipId: id, projectId: clip.project_id });

  return serveFile(req, abs, {
    downloadName: `${slug(clip.title ?? "clip")}-${resolution}p.mp4`,
  });
});

/** Export history row without streaming the bytes (used by the dashboard). */
export async function HEAD() {
  return new Response(null, { status: 204 });
}

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
