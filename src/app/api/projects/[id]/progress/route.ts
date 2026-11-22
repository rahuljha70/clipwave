import { forbidden, json, notFound, requireUser, route } from "@/lib/api";
import { projectProgress } from "@/lib/jobs";
import { q1, run, type Row } from "@/lib/db";
import { enqueue, cancelJob } from "@/lib/jobs";
import { getEffectivePlan } from "@/lib/plans";
import { nowIso } from "@/lib/db";

type Ctx = { params: Promise<{ id: string }> };

/** Live progress polling endpoint used by the processing screen. */
export const GET = route<Ctx>("projects.progress", async (_req, ctx) => {
  const { id } = await ctx.params;
  const user = await requireUser();
  const project = await q1<Row>(`SELECT user_id FROM projects WHERE id = ?`, [id]);
  if (!project) throw notFound("Project not found.");
  if (project.user_id !== user.id && user.role !== "admin") throw forbidden();
  const snapshot = await projectProgress(id);
  if (!snapshot) throw notFound("Project not found.");
  return json(snapshot);
});

/** Retries a failed project (or cancels an in-flight one). */
export const POST = route<Ctx>("projects.progress.post", async (req, ctx) => {
  const { id } = await ctx.params;
  const user = await requireUser();
  const row = await q1<Row>(`SELECT * FROM projects WHERE id = ?`, [id]);
  if (!row) throw notFound("Project not found.");
  if (row.user_id !== user.id && user.role !== "admin") throw forbidden();

  const body: unknown = await req.json().catch(() => ({}));
  const action =
    typeof body === "object" && body !== null && "action" in body && typeof body.action === "string"
      ? body.action
      : "retry";

  if (action === "cancel") {
    const job = await q1<Row>(
      `SELECT id FROM jobs WHERE project_id = ? AND status IN ('queued','running') ORDER BY created_at DESC LIMIT 1`,
      [id],
    );
    if (job) await cancelJob(String(job.id));
    await run(`UPDATE projects SET status='canceled', stage='Canceled', updated_at=? WHERE id=?`, [
      nowIso(),
      id,
    ]);
    return json({ ok: true, status: "canceled" });
  }

  if (row.status === "processing" || row.status === "queued") {
    return json({ ok: false, message: "This project is already processing." }, 409);
  }

  const plan = getEffectivePlan(row.platform ? user.plan : "free", user.role === "admin");
  await run(
    `UPDATE projects SET status='queued', stage='Queued for processing', progress=0, error=NULL, updated_at=? WHERE id=?`,
    [nowIso(), id],
  );
  const jobId = await enqueue({
    type: "process_project",
    projectId: id,
    userId: row.user_id,
    priority: plan.priority,
  });
  return json({ ok: true, jobId });
});
