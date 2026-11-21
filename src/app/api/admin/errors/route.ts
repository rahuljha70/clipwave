import { json, requireAdmin, route } from "@/lib/api";
import { q, type Row } from "@/lib/db";

export const GET = route("admin.errors", async () => {
  await requireAdmin();
  const rows = await q<Row>(
    `SELECT * FROM error_logs ORDER BY created_at DESC LIMIT 80`,
  );
  const failedJobs = await q<Row>(
    `SELECT j.id, j.type, j.error, j.created_at, p.title AS project_title
       FROM jobs j LEFT JOIN projects p ON p.id = j.project_id
      WHERE j.status = 'failed' ORDER BY j.created_at DESC LIMIT 30`,
  );
  return json({
    errors: rows.map((r) => ({
      id: r.id,
      level: r.level,
      scope: r.scope,
      message: r.message,
      stack: r.stack,
      context: r.context_json ? JSON.parse(r.context_json) : null,
      createdAt: r.created_at,
    })),
    failedJobs: failedJobs.map((r) => ({
      id: r.id,
      type: r.type,
      error: r.error,
      projectTitle: r.project_title,
      createdAt: r.created_at,
    })),
  });
});
