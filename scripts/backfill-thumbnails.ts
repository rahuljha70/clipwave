/**
 * Regenerates thumbnails (16:9 + 9:16) and player posters for clips that were
 * rendered before those artefacts existed.
 *
 *   npx tsx scripts/backfill-thumbnails.ts [projectId]
 */
import path from "node:path";
import { parseJson, q, q1, run, type Row } from "../src/lib/db";
import { absPath, ensureDir } from "../src/lib/storage";
import { storageClipPath } from "../src/lib/paths";
import { grabStill } from "../src/lib/media/ffmpeg";
import { composeThumbnail } from "../src/lib/thumbnails";

async function main() {
  const projectId = process.argv[2];

  /* project posters (uploads and any row created before posters existed) */
  const projects = projectId
    ? await q<Row>(`SELECT * FROM projects WHERE id = ?`, [projectId])
    : await q<Row>(`SELECT * FROM projects WHERE thumbnail_url IS NULL AND media_path IS NOT NULL`);
  for (const project of projects) {
    if (!project.media_path) continue;
    const posterRel = `projects/${project.id}/poster.jpg`;
    const abs = absPath(posterRel);
    await ensureDir(path.dirname(abs));
    const at = Math.min(Math.max(Number(project.duration_sec ?? 0) * 0.1, 0.5), 30);
    try {
      await grabStill(absPath(String(project.media_path)), at, abs, 1280);
      await run(`UPDATE projects SET thumbnail_url = ? WHERE id = ?`, [`/api/media/${posterRel}`, project.id]);
      console.log(`- project ${project.id}: poster`);
    } catch (err: any) {
      console.log(`- project ${project.id}: poster failed (${err.message})`);
    }
  }

  const clips = projectId
    ? await q<Row>(`SELECT * FROM clips WHERE project_id = ? AND status = 'ready'`, [projectId])
    : await q<Row>(`SELECT * FROM clips WHERE status = 'ready'`);

  console.log(`backfilling ${clips.length} clip(s)`);

  for (const clip of clips) {
    const clipDir = absPath(storageClipPath(String(clip.project_id), String(clip.id)));
    await ensureDir(clipDir);
    const render = clip.render_path ? absPath(String(clip.render_path)) : null;
    if (!render) {
      console.log(`- ${clip.id}: no render, skipped`);
      continue;
    }

    // player poster comes from the render; the thumbnail frame must come from the
    // SOURCE so burned-in captions never end up in a cover image
    const poster = path.join(clipDir, "poster.jpg");
    await grabStill(render, 0.3, poster, 1080).catch(() => {});

    const project = await q1<Row>(`SELECT media_path FROM projects WHERE id = ?`, [clip.project_id]);
    const source = project?.media_path ? absPath(String(project.media_path)) : render;
    const still = path.join(clipDir, "still-card.jpg");
    await grabStill(
      source,
      Number(clip.start_sec) + Math.max(0.5, Number(clip.duration_sec) * 0.35),
      still,
      1080,
    ).catch(() => {});

    const seo = parseJson<{ thumbnailText?: string } | null>(clip.seo_json, null);
    const text = String(seo?.thumbnailText || clip.title || "WATCH THIS").slice(0, 42);
    await composeThumbnail({
      framePath: still,
      outputPath: path.join(clipDir, "thumbnail-9x16.jpg"),
      text,
      badge: `${clip.viral_score}`,
      category: String(clip.category ?? "conversation"),
      width: 1080,
      height: 1920,
    }).catch((err: any) => console.log(`  thumbnail failed: ${err.message}`));

    await run(`UPDATE clips SET updated_at = updated_at WHERE id = ?`, [clip.id]);
    console.log(`- ${clip.id}: poster + portrait thumbnail`);
  }
  console.log("done");
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
