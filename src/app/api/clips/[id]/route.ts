import { z } from "zod";
import { badRequest, forbidden, json, notFound, readJson, requireUser, route } from "@/lib/api";
import { nowIso, parseJson, q1, run, type Row } from "@/lib/db";
import { clipToDto, mediaUrl } from "@/lib/clip-utils";
import { projectToDto } from "@/lib/serializers";
import type { Word } from "@/lib/media/subtitles";
import { getEffectivePlan } from "@/lib/plans";

type Ctx = { params: Promise<{ id: string }> };

export const GET = route<Ctx>("clips.get", async (_req, ctx) => {
  const { id } = await ctx.params;
  const user = await requireUser();
  const clip = await q1<Row>(`SELECT * FROM clips WHERE id = ?`, [id]);
  if (!clip) throw notFound("Clip not found.");
  if (clip.user_id !== user.id && user.role !== "admin") throw forbidden();
  const project = await q1<Row>(`SELECT * FROM projects WHERE id = ?`, [clip.project_id]);
  const siblings = await q1<Row>(
    `SELECT COUNT(*) AS n FROM clips WHERE project_id = ?`,
    [clip.project_id],
  );

  const plan = getEffectivePlan(user.plan, user.role === "admin");

  return json({
    clip: clipToDto(clip),
    project: project ? projectToDto(project) : null,
    words: parseJson<Word[]>(clip.words_json, []),
    siblingCount: Number(siblings?.n ?? 1),
    /* entitlements so the studio locks what the backend would reject anyway */
    plan: {
      id: plan.id,
      name: plan.name,
      subtitleStyles: plan.subtitleStyles,
      maxResolution: plan.maxResolution,
      maxFps: plan.maxFps,
      watermark: plan.watermark,
    },
  });
});

const patchSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  seo: z.record(z.string(), z.any()).optional(),
  edits: z.record(z.string(), z.any()).optional(),
  subtitleConfig: z.record(z.string(), z.any()).optional(),
  startSec: z.number().min(0).optional(),
  endSec: z.number().min(0).optional(),
  saved: z.boolean().optional(),
});

/** Persists editor changes. Re-rendering is a separate explicit action. */
export const PATCH = route<Ctx>("clips.patch", async (req, ctx) => {
  const { id } = await ctx.params;
  const user = await requireUser();
  const clip = await q1<Row>(`SELECT * FROM clips WHERE id = ?`, [id]);
  if (!clip) throw notFound("Clip not found.");
  if (clip.user_id !== user.id && user.role !== "admin") throw forbidden();

  const parsed = patchSchema.safeParse(await readJson(req));
  if (!parsed.success) throw badRequest("Invalid clip update.");
  const body = parsed.data;

  const fields: string[] = [];
  const params: any[] = [];
  if (body.title) {
    fields.push("title = ?");
    params.push(body.title);
  }
  if (body.seo) {
    fields.push("seo_json = ?");
    params.push(JSON.stringify(body.seo));
  }
  if (body.edits) {
    fields.push("edits_json = ?");
    params.push(JSON.stringify(body.edits));
  }
  if (body.subtitleConfig) {
    fields.push("ass_json = ?");
    params.push(JSON.stringify(body.subtitleConfig));
  }
  if (body.saved !== undefined) {
    fields.push("saved = ?");
    params.push(body.saved ? 1 : 0);
  }
  if (body.startSec !== undefined && body.endSec !== undefined) {
    if (body.endSec - body.startSec < 3) throw badRequest("A clip must be at least 3 seconds long.");
    if (body.endSec - body.startSec > 180) throw badRequest("Clips are limited to 180 seconds.");
    fields.push("start_sec = ?", "end_sec = ?", "duration_sec = ?");
    params.push(body.startSec, body.endSec, body.endSec - body.startSec);
  }
  if (!fields.length) throw badRequest("Nothing to update.");
  fields.push("updated_at = ?");
  params.push(nowIso(), id);
  await run(`UPDATE clips SET ${fields.join(", ")} WHERE id = ?`, params);

  const fresh = await q1<Row>(`SELECT * FROM clips WHERE id = ?`, [id]);
  return json({ clip: clipToDto(fresh!) });
});

export const DELETE = route<Ctx>("clips.delete", async (_req, ctx) => {
  const { id } = await ctx.params;
  const user = await requireUser();
  const clip = await q1<Row>(`SELECT * FROM clips WHERE id = ?`, [id]);
  if (!clip) throw notFound("Clip not found.");
  if (clip.user_id !== user.id && user.role !== "admin") throw forbidden();
  await run(`DELETE FROM clips WHERE id = ?`, [id]);
  await run(`UPDATE projects SET clip_count = (SELECT COUNT(*) FROM clips WHERE project_id = ?) WHERE id = ?`, [
    clip.project_id,
    clip.project_id,
  ]);
  return json({ ok: true, thumbnailUrl: mediaUrl(clip.thumbnail_path ?? "") });
});
