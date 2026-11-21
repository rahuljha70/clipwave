import { z } from "zod";
import { badRequest, json, readJson, requireUser, route } from "@/lib/api";
import { hashPassword, publicUser, verifyPassword } from "@/lib/auth";
import { getSessionUser } from "@/lib/auth";
import { nowIso, q1, run, type Row } from "@/lib/db";

const schema = z.object({
  name: z.string().min(1).max(80).optional(),
  avatarUrl: z.string().url().max(500).optional().or(z.literal("")),
  currentPassword: z.string().optional(),
  newPassword: z.string().min(8).optional(),
});

export const PATCH = route("auth.profile", async (req) => {
  const user = await requireUser();
  const parsed = schema.safeParse(await readJson(req));
  if (!parsed.success) throw badRequest("Invalid profile details.");

  const updates: string[] = [];
  const params: any[] = [];
  if (parsed.data.name) {
    updates.push("name = ?");
    params.push(parsed.data.name);
  }
  if (parsed.data.avatarUrl !== undefined) {
    updates.push("avatar_url = ?");
    params.push(parsed.data.avatarUrl || null);
  }
  if (parsed.data.newPassword) {
    const row = await q1<Row>(`SELECT password_hash FROM users WHERE id = ?`, [user.id]);
    if (row?.password_hash && !verifyPassword(parsed.data.currentPassword ?? "", row.password_hash)) {
      throw badRequest("Your current password is incorrect.");
    }
    updates.push("password_hash = ?");
    params.push(hashPassword(parsed.data.newPassword));
  }
  if (!updates.length) throw badRequest("Nothing to update.");

  updates.push("updated_at = ?");
  params.push(nowIso(), user.id);
  await run(`UPDATE users SET ${updates.join(", ")} WHERE id = ?`, params);

  const fresh = await getSessionUser();
  return json({ user: fresh ? publicUser(fresh) : null });
});
