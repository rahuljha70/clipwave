import crypto from "node:crypto";
import { z } from "zod";
import { badRequest, json, notFound, readJson, requireAdmin, route } from "@/lib/api";
import { nowIso, q1, run, type Row } from "@/lib/db";
import { cancelJob, recordJobLog } from "@/lib/jobs";

type Ctx = { params: Promise<{ id: string }> };

const schema = z.object({ action: z.enum(["cancel", "retry"]) });

export const POST = route<Ctx>("admin.jobs.action", async (req, ctx) => {
  const admin = await requireAdmin();
  const { id } = await ctx.params;
  const job = await q1<Row>(`SELECT * FROM jobs WHERE id = ?`, [id]);
  if (!job) throw notFound("Job not found.");
  const parsed = schema.safeParse(await readJson(req));
  if (!parsed.success) throw badRequest("Unknown action.");

  if (parsed.data.action === "cancel") {
    await cancelJob(id);
  } else {
    await run(
      `UPDATE jobs SET status='queued', attempts=0, error=NULL, stage='Requeued by admin', updated_at=? WHERE id=?`,
      [nowIso(), id],
    );
    await recordJobLog(id, `Requeued by admin ${admin.email}`, "warn");
    if (job.type === "process_project" && job.project_id) {
      await run(`UPDATE projects SET status='queued', error=NULL, progress=0, updated_at=? WHERE id=?`, [
        nowIso(),
        job.project_id,
      ]);
    }
  }

  await run(
    `INSERT INTO admin_audit (id, admin_id, action, target, meta_json, created_at) VALUES (?, ?, ?, ?, ?, ?)`,
    [
      crypto.randomUUID(),
      admin.id,
      `job.${parsed.data.action}`,
      id,
      JSON.stringify({ type: job.type }),
      nowIso(),
    ],
  );
  return json({ ok: true });
});
