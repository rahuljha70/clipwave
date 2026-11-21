import { json, requireUser, route } from "@/lib/api";
import { q, q1, type Row } from "@/lib/db";
import { getUsage, usageSeries } from "@/lib/entitlements";
import { clipToDto } from "@/lib/clip-utils";
import { projectToDto } from "@/lib/serializers";
import { userStorageBytes } from "@/lib/storage";
import { PLANS } from "@/lib/plans";

export const GET = route("dashboard", async () => {
  const user = await requireUser();
  const [usage, series] = await Promise.all([
    getUsage(user.id, user.plan, user.role === "admin"),
    usageSeries(user.id, 14),
  ]);

  const [projects, clips, saved, queue, exportCount, storage] = await Promise.all([
    q<Row>(
      `SELECT p.*, (SELECT COUNT(*) FROM clips c WHERE c.project_id = p.id AND c.status='ready') AS ready_clips
         FROM projects p WHERE p.user_id = ? ORDER BY p.created_at DESC LIMIT 6`,
      [user.id],
    ),
    q1<Row>(`SELECT COUNT(*) AS n FROM clips WHERE user_id = ? AND status = 'ready'`, [user.id]),
    q<Row>(
      `SELECT c.*, p.title AS project_title FROM clips c JOIN projects p ON p.id = c.project_id
        WHERE c.user_id = ? AND c.saved = 1 ORDER BY c.created_at DESC LIMIT 6`,
      [user.id],
    ),
    q<Row>(
      `SELECT j.id, j.type, j.status, j.stage, j.progress, j.created_at, p.title AS project_title, p.id AS project_id
         FROM jobs j LEFT JOIN projects p ON p.id = j.project_id
        WHERE j.user_id = ? AND j.status IN ('queued','running')
        ORDER BY j.created_at ASC LIMIT 10`,
      [user.id],
    ),
    q1<Row>(`SELECT COUNT(*) AS n FROM exports WHERE user_id = ?`, [user.id]),
    userStorageBytes(user.id).catch(() => 0),
  ]);

  const totals = await q1<Row>(
    `SELECT
        (SELECT COUNT(*) FROM projects WHERE user_id = ?) AS projects,
        (SELECT COUNT(*) FROM clips WHERE user_id = ?) AS clips,
        (SELECT COALESCE(SUM(duration_sec),0) FROM projects WHERE user_id = ?) AS seconds`,
    [user.id, user.id, user.id],
  );

  return json({
    usage,
    series,
    plan: PLANS[usage.plan.id],
    stats: {
      projects: Number(totals?.projects ?? 0),
      clips: Number(totals?.clips ?? 0),
      readyClips: Number(clips?.n ?? 0),
      savedClips: saved.length,
      exports: Number(exportCount?.n ?? 0),
      processedMinutes: Math.round((Number(totals?.seconds ?? 0) / 60) * 10) / 10,
      storageBytes: storage,
    },
    recentProjects: projects.map(projectToDto),
    savedClips: saved.map(clipToDto),
    queue: queue.map((r) => ({
      id: r.id,
      type: r.type,
      status: r.status,
      stage: r.stage,
      progress: Number(r.progress ?? 0),
      projectId: r.project_id,
      projectTitle: r.project_title,
      createdAt: r.created_at,
    })),
  });
});
