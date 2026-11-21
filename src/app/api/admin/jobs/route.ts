import { json, requireAdmin, route } from "@/lib/api";
import { q, type Row } from "@/lib/db";

export const GET = route("admin.jobs", async (req) => {
  await requireAdmin();
  const url = new URL(req.url);
  const status = url.searchParams.get("status");
  const limit = Math.min(200, Number(url.searchParams.get("limit") ?? 50));
  const rows = await q<Row>(
    `SELECT j.*, p.title AS project_title, u.email AS user_email
       FROM jobs j
       LEFT JOIN projects p ON p.id = j.project_id
       LEFT JOIN users u ON u.id = j.user_id
      ${status ? "WHERE j.status = ?" : ""}
      ORDER BY j.created_at DESC LIMIT ?`,
    status ? [status, limit] : [limit],
  );
  const counts = await q<Row>(`SELECT status, COUNT(*) AS n FROM jobs GROUP BY status`);
  return json({
    jobs: rows.map((r) => ({
      id: r.id,
      type: r.type,
      status: r.status,
      stage: r.stage,
      progress: Number(r.progress ?? 0),
      attempts: Number(r.attempts ?? 0),
      error: r.error,
      projectId: r.project_id,
      projectTitle: r.project_title,
      userEmail: r.user_email,
      workerId: r.worker_id,
      createdAt: r.created_at,
      finishedAt: r.finished_at,
    })),
    counts: Object.fromEntries(counts.map((c) => [String(c.status), Number(c.n)])),
  });
});
