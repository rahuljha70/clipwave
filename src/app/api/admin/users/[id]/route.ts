import crypto from "node:crypto";
import { z } from "zod";
import { badRequest, json, notFound, readJson, requireAdmin, route } from "@/lib/api";
import { nowIso, q1, run, type Row } from "@/lib/db";

type Ctx = { params: Promise<{ id: string }> };

const schema = z.object({
  plan: z.enum(["free", "pro", "ultimate"]).optional(),
  role: z.enum(["user", "admin"]).optional(),
  planStatus: z.enum(["active", "past_due", "canceled"]).optional(),
  /** Positive credits +seconds to the current month, negative debits. */
  creditAdjustSeconds: z.number().min(-100000).max(100000).optional(),
  reason: z.string().max(200).optional(),
});

export const PATCH = route<Ctx>("admin.users.patch", async (req, ctx) => {
  const admin = await requireAdmin();
  const { id } = await ctx.params;
  const target = await q1<Row>(`SELECT * FROM users WHERE id = ?`, [id]);
  if (!target) throw notFound("User not found.");

  const parsed = schema.safeParse(await readJson(req));
  if (!parsed.success) throw badRequest("Invalid update.");
  const body = parsed.data;
  if (target.id === admin.id && body.role === "user") {
    throw badRequest("You cannot remove your own administrator access.");
  }
  const willBeAdmin = body.role === "admin" || (body.role === undefined && target.role === "admin");
  if (
    willBeAdmin &&
    ((body.plan !== undefined && body.plan !== "ultimate") ||
      (body.planStatus !== undefined && body.planStatus !== "active"))
  ) {
    throw badRequest("Administrator accounts always have unlimited Ultimate access.");
  }

  const fields: string[] = [];
  const params: any[] = [];
  if (body.role) {
    fields.push("role = ?");
    params.push(body.role);
  }
  if (willBeAdmin) {
    fields.push("plan = 'ultimate'", "plan_status = 'active'", "plan_renews_at = NULL");
  } else {
    if (body.plan) {
      fields.push("plan = ?");
      params.push(body.plan);
    }
    if (body.planStatus) {
      fields.push("plan_status = ?");
      params.push(body.planStatus);
    }
  }
  if (fields.length) {
    fields.push("updated_at = ?");
    params.push(nowIso(), id);
    await run(`UPDATE users SET ${fields.join(", ")} WHERE id = ?`, params);
  }

  if (body.creditAdjustSeconds) {
    await run(
      `INSERT INTO usage_events (id, user_id, kind, seconds, meta_json, created_at)
       VALUES (?, ?, 'processed_seconds', ?, ?, ?)`,
      [
        crypto.randomUUID(),
        id,
        -Math.abs(body.creditAdjustSeconds) * Math.sign(body.creditAdjustSeconds),
        JSON.stringify({ adminAdjust: true, by: admin.email, reason: body.reason ?? null }),
        nowIso(),
      ],
    );
  }

  await run(
    `INSERT INTO admin_audit (id, admin_id, action, target, meta_json, created_at) VALUES (?, ?, 'user.update', ?, ?, ?)`,
    [crypto.randomUUID(), admin.id, id, JSON.stringify(body), nowIso()],
  );

  return json({ ok: true });
});
