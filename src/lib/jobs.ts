/**
 * Durable job queue backed by the database (works on SQLite and Postgres).
 * A separate worker process claims jobs, so HTTP requests never block on FFmpeg
 * or Whisper. Redis/BullMQ can be layered on top — see README.
 */
import crypto from "node:crypto";
import { nowIso, q, q1, run, transaction, type Row, type SqlValue } from "./db";

export type JobType = "process_project" | "render_clip" | "regenerate_seo";
export type JobStatus = "queued" | "running" | "done" | "failed" | "canceled";

export async function enqueue(input: {
  type: JobType;
  projectId?: string | null;
  userId?: string | null;
  priority?: number;
  payload?: Record<string, unknown>;
  resetProjectStatus?: boolean;
}): Promise<string> {
  const id = crypto.randomUUID();
  await run(
    `INSERT INTO jobs (id, project_id, user_id, type, status, progress, priority, payload_json, created_at, updated_at)
     VALUES (?, ?, ?, ?, 'queued', 0, ?, ?, ?, ?)`,
    [
      id,
      input.projectId ?? null,
      input.userId ?? null,
      input.type,
      input.priority ?? 0,
      input.payload ? JSON.stringify(input.payload) : null,
      nowIso(),
      nowIso(),
    ],
  );
  await recordJobLog(id, "Job queued");
  return id;
}

export async function recordJobLog(jobId: string, message: string, level = "info") {
  try {
    await run(
      `INSERT INTO job_logs (id, job_id, level, message, created_at) VALUES (?, ?, ?, ?, ?)`,
      [crypto.randomUUID(), jobId, level, message.slice(0, 500), nowIso()],
    );
  } catch {
    /* logging must never fail the job */
  }
}

export async function claimNext(workerId: string): Promise<Row | null> {
  return transaction(async (d) => {
    const row = await d.get<Row>(
      `SELECT * FROM jobs WHERE status = 'queued'
        ORDER BY priority DESC, created_at ASC LIMIT 1`,
    );
    if (!row) return null;
    const result = await d.run(
      `UPDATE jobs SET status='running', worker_id=?, locked_at=?, attempts=attempts+1, updated_at=?
        WHERE id=? AND status='queued'`,
      [workerId, nowIso(), nowIso(), row.id],
    );
    if (result.changes === 0) return null;
    return { ...row, status: "running", attempts: Number(row.attempts) + 1 };
  });
}

export async function updateJob(
  jobId: string,
  patch: { status?: JobStatus; progress?: number; stage?: string | null; error?: string | null },
) {
  const fields: string[] = [];
  const params: SqlValue[] = [];
  if (patch.status) {
    fields.push("status = ?");
    params.push(patch.status);
    if (["done", "failed", "canceled"].includes(patch.status)) {
      fields.push("finished_at = ?");
      params.push(nowIso());
    }
  }
  if (patch.progress !== undefined) {
    fields.push("progress = ?");
    params.push(Math.max(0, Math.min(100, Math.round(patch.progress))));
  }
  if (patch.stage !== undefined) {
    fields.push("stage = ?");
    params.push(patch.stage);
  }
  if (patch.error !== undefined) {
    fields.push("error = ?");
    params.push(patch.error);
  }
  if (!fields.length) return;
  fields.push("updated_at = ?");
  params.push(nowIso(), jobId);
  await run(`UPDATE jobs SET ${fields.join(", ")} WHERE id = ?`, params);
}

/** Requeues stuck jobs (worker crashed / restarted) — safe to call periodically. */
/**
 * A worker refreshes `locked_at` every 30 s while it runs a job, so a stale
 * lock means the process died. Anything silent for longer than this is
 * requeued (the retry counter in the worker keeps that bounded).
 */
export async function requeueStaleJobs(maxAgeMinutes = 3): Promise<number> {
  const cutoff = new Date(Date.now() - maxAgeMinutes * 60_000).toISOString();
  const stale = await q<Row>(
    `SELECT id FROM jobs
      WHERE status = 'running' AND COALESCE(locked_at, updated_at) < ?`,
    [cutoff],
  );
  for (const job of stale) {
    await run(
      `UPDATE jobs SET status='queued', stage='Requeued after worker timeout',
              locked_at=NULL, worker_id=NULL, updated_at=? WHERE id=? AND status='running'`,
      [nowIso(), job.id],
    );
    await recordJobLog(job.id, "Worker heartbeat lost — job requeued", "warn");
  }
  return stale.length;
}

/** Keeps the lock fresh so a long render is not mistaken for a dead worker. */
export async function touchJob(jobId: string) {
  await run(`UPDATE jobs SET locked_at = ?, updated_at = ? WHERE id = ? AND status = 'running'`, [
    nowIso(),
    nowIso(),
    jobId,
  ]);
}

export async function cancelJob(jobId: string) {
  await run(
    `UPDATE jobs SET status='canceled', finished_at=?, updated_at=? WHERE id=? AND status IN ('queued','running')`,
    [nowIso(), nowIso(), jobId],
  );
  await recordJobLog(jobId, "Job canceled by user", "warn");
}

export async function getJob(jobId: string) {
  return q1<Row>(`SELECT * FROM jobs WHERE id = ?`, [jobId]);
}

/** Snapshot used by the UI for live progress (project + active job + clip statuses). */
export async function projectProgress(projectId: string) {
  const project = await q1<Row>(
    `SELECT id, status, stage, progress, error, clip_count, requested_clips, started_at, finished_at
       FROM projects WHERE id = ?`,
    [projectId],
  );
  if (!project) return null;
  const job = await q1<Row>(
    `SELECT id, status, stage, progress, error, type, attempts, created_at
       FROM jobs WHERE project_id = ? ORDER BY created_at DESC LIMIT 1`,
    [projectId],
  );
  const clips = await q<Row>(
    `SELECT id, status, progress, position FROM clips WHERE project_id = ? ORDER BY position`,
    [projectId],
  );
  const logs = job
    ? await q<Row>(
        `SELECT message, level, created_at FROM job_logs WHERE job_id = ? ORDER BY created_at ASC LIMIT 80`,
        [job.id],
      )
    : [];
  return { project, job, clips, logs };
}
