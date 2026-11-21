import { json, requireAdmin, route } from "@/lib/api";
import { q, q1, type Row } from "@/lib/db";
import { PLANS } from "@/lib/plans";
import { dirSizeRel } from "@/lib/storage";

export const GET = route("admin.stats", async () => {
  await requireAdmin();
  const [users, subs, projects, clips, jobs, errors, storage, recentUsers] = await Promise.all([
    q1<Row>(`SELECT COUNT(*) AS n FROM users`),
    q<Row>(`SELECT plan, COUNT(*) AS n FROM users GROUP BY plan`),
    q1<Row>(
      `SELECT COUNT(*) AS total,
              SUM(CASE WHEN status='ready' THEN 1 ELSE 0 END) AS ready,
              SUM(CASE WHEN status='failed' THEN 1 ELSE 0 END) AS failed,
              COALESCE(SUM(duration_sec),0) AS seconds
         FROM projects`,
    ),
    q1<Row>(
      `SELECT COUNT(*) AS total, SUM(CASE WHEN status='ready' THEN 1 ELSE 0 END) AS ready FROM clips`,
    ),
    q<Row>(`SELECT status, COUNT(*) AS n FROM jobs GROUP BY status`),
    q1<Row>(`SELECT COUNT(*) AS n FROM error_logs WHERE created_at > ?`, [
      new Date(Date.now() - 7 * 86400_000).toISOString(),
    ]),
    dirSizeRel("projects").catch(() => 0),
    q<Row>(
      `SELECT u.id, u.email, u.name, u.plan, u.role, u.created_at,
              (SELECT COUNT(*) FROM projects p WHERE p.user_id = u.id) AS projects
         FROM users u ORDER BY u.created_at DESC LIMIT 5`,
    ),
  ]);

  const planCounts: Record<string, number> = { free: 0, pro: 0, ultimate: 0 };
  for (const row of subs) planCounts[String(row.plan)] = Number(row.n);
  const mrr = planCounts.pro * PLANS.pro.priceMonthly + planCounts.ultimate * PLANS.ultimate.priceMonthly;

  const jobCounts: Record<string, number> = {};
  for (const row of jobs) jobCounts[String(row.status)] = Number(row.n);

  return json({
    users: {
      total: Number(users?.n ?? 0),
      byPlan: planCounts,
      paying: planCounts.pro + planCounts.ultimate,
      new: recentUsers,
    },
    revenue: {
      mrr,
      arr: mrr * 12,
      arpu: Number(users?.n ?? 0) > 0 ? Math.round((mrr / Number(users?.n)) * 100) / 100 : 0,
      note: "Estimated from active plan subscriptions.",
    },
    projects: {
      total: Number(projects?.total ?? 0),
      ready: Number(projects?.ready ?? 0),
      failed: Number(projects?.failed ?? 0),
      processedMinutes: Math.round((Number(projects?.seconds ?? 0) / 60) * 10) / 10,
    },
    clips: {
      total: Number(clips?.total ?? 0),
      ready: Number(clips?.ready ?? 0),
    },
    jobs: jobCounts,
    errors7d: Number(errors?.n ?? 0),
    storageBytes: storage,
  });
});
