import { forbidden, json, notFound, requireUser, route } from "@/lib/api";
import { nowIso, q1, run, type Row } from "@/lib/db";
import { enqueue } from "@/lib/jobs";
import { clipToDto } from "@/lib/clip-utils";

type Ctx = { params: Promise<{ id: string }> };

/** Regenerates titles / description / hashtags for a clip (runs in the worker). */
export const POST = route<Ctx>("clips.seo", async (_req, ctx) => {
  const { id } = await ctx.params;
  const user = await requireUser();
  const clip = await q1<Row>(`SELECT * FROM clips WHERE id = ?`, [id]);
  if (!clip) throw notFound("Clip not found.");
  if (clip.user_id !== user.id && user.role !== "admin") throw forbidden();

  await run(`UPDATE clips SET updated_at = ? WHERE id = ?`, [nowIso(), id]);
  const jobId = await enqueue({
    type: "regenerate_seo",
    projectId: String(clip.project_id),
    userId: String(clip.user_id),
    priority: 2,
    payload: { clipId: id },
  });
  return json({ ok: true, jobId }, 202);
});

export const GET = route<Ctx>("clips.seo.get", async (_req, ctx) => {
  const { id } = await ctx.params;
  const user = await requireUser();
  const clip = await q1<Row>(`SELECT * FROM clips WHERE id = ?`, [id]);
  if (!clip) throw notFound("Clip not found.");
  if (clip.user_id !== user.id && user.role !== "admin") throw forbidden();
  return json({ clip: clipToDto(clip) });
});
