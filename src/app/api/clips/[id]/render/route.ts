import { z } from "zod";
import { badRequest, forbidden, json, notFound, readJson, requireUser, route } from "@/lib/api";
import { nowIso, q1, run, type Row } from "@/lib/db";
import { enqueue } from "@/lib/jobs";
import { getEffectivePlan } from "@/lib/plans";

type Ctx = { params: Promise<{ id: string }> };

const schema = z.object({
  startSec: z.number().min(0).optional(),
  endSec: z.number().min(0).optional(),
  subtitleConfig: z.record(z.string(), z.unknown()).optional(),
  edits: z.record(z.string(), z.unknown()).optional(),
  words: z
    .array(
      z.object({
        start: z.number().min(0),
        end: z.number().min(0),
        word: z.string().min(1).max(60),
        speaker: z.number().optional(),
      }),
    )
    .max(4000)
    .optional(),
  textOverlay: z
    .object({
      text: z.string().max(120),
      position: z.enum(["top", "bottom"]),
      startSec: z.number().min(0),
      endSec: z.number().min(0),
    })
    .nullable()
    .optional(),
});

/** Queues a re-render with the current editor state (trim, crop, captions, extras). */
export const POST = route<Ctx>("clips.render", async (req, ctx) => {
  const { id } = await ctx.params;
  const user = await requireUser();
  const clip = await q1<Row>(`SELECT * FROM clips WHERE id = ?`, [id]);
  if (!clip) throw notFound("Clip not found.");
  if (clip.user_id !== user.id && user.role !== "admin") throw forbidden();

  const parsed = schema.safeParse(await readJson(req).catch(() => ({})));
  if (!parsed.success) throw badRequest("Invalid render request.");
  const { startSec, endSec, subtitleConfig, edits, textOverlay, words } = parsed.data;

  const start = startSec ?? Number(clip.start_sec);
  const end = endSec ?? Number(clip.end_sec);
  if (end - start < 3) throw badRequest("Select at least 3 seconds of video.");
  if (end - start > 180) throw badRequest("Clips are limited to 180 seconds.");

  const project = await q1<Row>(`SELECT * FROM projects WHERE id = ?`, [clip.project_id]);
  const plan = getEffectivePlan(user.plan, user.role === "admin");

  if (edits?.subtitleStyle && !plan.subtitleStyles.includes(String(edits.subtitleStyle))) {
    return json(
      {
        error: "That caption style isn't included in your plan. Upgrade to unlock it.",
        code: "upgrade",
      },
      402,
    );
  }
  if (edits?.fps !== undefined) {
    const fps = Number(edits.fps);
    if (!(fps === 30 || fps === 60)) throw badRequest("Frame rate must be 30 or 60.");
    if (fps > plan.maxFps) {
      return json(
        {
          error: `${fps} FPS export is available on the Ultimate plan. Your plan renders ${plan.maxFps} FPS.`,
          code: "upgrade",
        },
        402,
      );
    }
  }
  if (edits?.watermarkDisabled && plan.watermark) {
    return json(
      { error: "Removing the watermark requires the Pro plan.", code: "upgrade" },
      402,
    );
  }
  if (edits?.speed !== undefined) {
    const speed = Number(edits.speed);
    if (!(speed >= 0.5 && speed <= 2)) throw badRequest("Playback speed must be between 0.5× and 2×.");
  }

  if (project?.status !== "ready") {
    return json({ error: "The source project is still processing.", code: "busy" }, 409);
  }

  await run(
    `UPDATE clips SET status = 'rendering', progress = 0, error = NULL, updated_at = ? WHERE id = ?`,
    [nowIso(), id],
  );
  const jobId = await enqueue({
    type: "render_clip",
    projectId: String(clip.project_id),
    userId: String(clip.user_id),
    priority: plan.priority,
    payload: { clipId: id, overrides: { start, end, subtitleConfig, edits, textOverlay, words } },
  });

  return json({ ok: true, jobId, overrides: { start, end } }, 202);
});
