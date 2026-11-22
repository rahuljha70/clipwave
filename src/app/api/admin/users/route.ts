import { json, requireAdmin, route } from "@/lib/api";
import { q, type Row, type SqlValue } from "@/lib/db";

export const GET = route("admin.users", async (req) => {
  await requireAdmin();
  const url = new URL(req.url);
  const search = (url.searchParams.get("q") ?? "").trim();
  const plan = url.searchParams.get("plan");
  const limit = Math.min(200, Number(url.searchParams.get("limit") ?? 50));

  const where: string[] = [];
  const params: SqlValue[] = [];
  if (search) {
    where.push("(u.email LIKE ? OR u.name LIKE ?)");
    params.push(`%${search}%`, `%${search}%`);
  }
  if (plan) {
    where.push("u.plan = ?");
    params.push(plan);
  }

  const rows = await q<Row>(
    `SELECT u.id, u.email, u.name, u.role, u.plan, u.plan_status, u.provider, u.created_at,
            (SELECT COUNT(*) FROM projects p WHERE p.user_id = u.id) AS projects,
            (SELECT COUNT(*) FROM clips c WHERE c.user_id = u.id) AS clips,
            (SELECT COALESCE(SUM(seconds),0) FROM usage_events e
              WHERE e.user_id = u.id AND e.kind = 'processed_seconds'
                AND e.created_at >= ?) AS seconds_this_month
       FROM users u
      ${where.length ? `WHERE ${where.join(" AND ")}` : ""}
      ORDER BY u.created_at DESC LIMIT ?`,
    [new Date(Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth(), 1)).toISOString(), ...params, limit],
  );

  return json({
    users: rows.map((r) => ({
      id: r.id,
      email: r.email,
      name: r.name,
      role: r.role,
      plan: r.plan,
      planStatus: r.plan_status,
      provider: r.provider,
      createdAt: r.created_at,
      projects: Number(r.projects ?? 0),
      clips: Number(r.clips ?? 0),
      minutesThisMonth: Math.round((Number(r.seconds_this_month ?? 0) / 60) * 10) / 10,
    })),
  });
});
