import fs from "node:fs/promises";
import path from "node:path";
import { forbidden, json, notFound, requireUser, route } from "@/lib/api";
import { nowIso, parseJson, q1, run, type Row } from "@/lib/db";
import { storageClipPath } from "@/lib/paths";
import { absPath, ensureDir } from "@/lib/storage";
import { captureFrames } from "@/lib/media/ffmpeg";
import { composeThumbnail, pickBestFrame } from "@/lib/thumbnails";
import { clipToDto } from "@/lib/clip-utils";
import type { SeoResult } from "@/lib/ai/seo";

type Ctx = { params: Promise<{ id: string }> };

/**
 * Regenerates the thumbnail. Accepts multipart/form-data so creators can supply
 * their own background frame and logo; otherwise the best frame is auto-picked.
 */
export const POST = route<Ctx>("clips.thumbnail", async (req, ctx) => {
  const { id } = await ctx.params;
  const user = await requireUser();
  const clip = await q1<Row>(`SELECT * FROM clips WHERE id = ?`, [id]);
  if (!clip) throw notFound("Clip not found.");
  if (clip.user_id !== user.id && user.role !== "admin") throw forbidden();

  const project = await q1<Row>(`SELECT * FROM projects WHERE id = ?`, [clip.project_id]);
  if (!project?.media_path) throw notFound("Source media unavailable.");

  const clipDir = absPath(storageClipPath(String(clip.project_id), id));
  await ensureDir(clipDir);

  const form = await req.formData().catch(() => null);
  const customText = form?.get("text") ? String(form.get("text")) : null;
  const frameTime = form?.get("frameTime") ? Number(form.get("frameTime")) : null;
  const background = form?.get("background");
  const logo = form?.get("logo");

  let framePath: string;
  if (background && typeof background === "object" && "arrayBuffer" in background) {
    framePath = path.join(clipDir, "custom-bg.jpg");
    await fs.writeFile(framePath, Buffer.from(await (background as File).arrayBuffer()));
  } else {
    const start = Number(clip.start_sec);
    const duration = Number(clip.duration_sec);
    const times = frameTime
      ? [frameTime]
      : [0.2, 0.4, 0.6, 0.8].map((f) => start + duration * f);
    const stills = await captureFrames(absPath(String(project.media_path)), path.join(clipDir, "stills"), {
      times,
      width: 1280,
    });
    const best = await pickBestFrame(stills);
    if (!best) throw notFound("Could not extract a frame for the thumbnail.");
    framePath = best;
  }

  let logoPath: string | null = null;
  if (logo && typeof logo === "object" && "arrayBuffer" in logo) {
    logoPath = path.join(clipDir, "logo.png");
    await fs.writeFile(logoPath, Buffer.from(await (logo as File).arrayBuffer()));
  }

  const seo = parseJson<SeoResult | null>(clip.seo_json, null);
  const outputPath = path.join(clipDir, "thumbnail.jpg");
  await composeThumbnail({
    framePath,
    outputPath,
    text: (customText || seo?.thumbnailText || clip.hook || "WATCH THIS").slice(0, 60),
    badge: `${clip.viral_score}`,
    category: clip.category,
    logoPath,
  });

  // portrait twin for in-app cards / Shorts covers
  await composeThumbnail({
    framePath,
    outputPath: path.join(clipDir, "thumbnail-9x16.jpg"),
    text: (customText || seo?.thumbnailText || clip.hook || "WATCH THIS").slice(0, 60),
    badge: `${clip.viral_score}`,
    category: clip.category,
    logoPath,
    width: 1080,
    height: 1920,
  }).catch(() => {});

  const rel = path.posix.join(storageClipPath(String(clip.project_id), id), "thumbnail.jpg");
  await run(`UPDATE clips SET thumbnail_path = ?, updated_at = ? WHERE id = ?`, [rel, nowIso(), id]);
  const fresh = await q1<Row>(`SELECT * FROM clips WHERE id = ?`, [id]);
  return json({ clip: clipToDto(fresh!) });
});
