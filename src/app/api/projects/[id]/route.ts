import { forbidden, json, notFound, requireUser, route } from "@/lib/api";
import { q, q1, run, type Row } from "@/lib/db";
import { clipToDto } from "@/lib/clip-utils";
import { projectToDto } from "@/lib/serializers";
import { storageProjectPath } from "@/lib/paths";
import { removeRel } from "@/lib/storage";

type Ctx = { params: Promise<{ id: string }> };

export const GET = route<Ctx>("projects.get", async (_req, ctx) => {
  const { id } = await ctx.params;
  const user = await requireUser();
  const project = await q1<Row>(`SELECT * FROM projects WHERE id = ?`, [id]);
  if (!project) throw notFound("Project not found.");
  if (project.user_id !== user.id && user.role !== "admin") throw forbidden();

  const clips = await q<Row>(
    `SELECT * FROM clips WHERE project_id = ? ORDER BY viral_score DESC, position ASC`,
    [id],
  );
  const job = await q1<Row>(
    `SELECT * FROM jobs WHERE project_id = ? ORDER BY created_at DESC LIMIT 1`,
    [id],
  );
  const logs = job
    ? await q<Row>(
        `SELECT message, level, created_at FROM job_logs WHERE job_id = ? ORDER BY created_at ASC LIMIT 120`,
        [job.id],
      )
    : [];
  const exportsRows = await q<Row>(
    `SELECT * FROM exports WHERE project_id = ? ORDER BY created_at DESC LIMIT 50`,
    [id],
  );

  return json({
    project: {
      ...projectToDto(project),
      analysis: project.analysis_json ? JSON.parse(project.analysis_json) : null,
      moments: project.moments_json ? JSON.parse(project.moments_json) : [],
      mediaReady: Boolean(project.media_path),
      finishedAt: project.finished_at,
    },
    clips: clips.map(clipToDto),
    job: job
      ? {
          id: job.id,
          status: job.status,
          stage: job.stage,
          progress: job.progress,
          error: job.error,
          attempts: job.attempts,
        }
      : null,
    logs,
    exports: exportsRows,
  });
});

export const DELETE = route<Ctx>("projects.delete", async (_req, ctx) => {
  const { id } = await ctx.params;
  const user = await requireUser();
  const project = await q1<Row>(`SELECT * FROM projects WHERE id = ?`, [id]);
  if (!project) throw notFound("Project not found.");
  if (project.user_id !== user.id && user.role !== "admin") throw forbidden();

  await run(`DELETE FROM clips WHERE project_id = ?`, [id]);
  await run(`DELETE FROM exports WHERE project_id = ?`, [id]);
  await run(`DELETE FROM jobs WHERE project_id = ?`, [id]);
  await run(`DELETE FROM projects WHERE id = ?`, [id]);
  await removeRel(storageProjectPath(id)).catch(() => {});
  return json({ ok: true });
});
