import { z } from "zod";
import { badRequest, json, readJson, route } from "@/lib/api";
import { hashPassword, sha256 } from "@/lib/auth";
import { nowIso, q1, run, type Row } from "@/lib/db";

const schema = z.object({
  token: z.string().min(10),
  password: z.string().min(8, "Use at least 8 characters."),
});

export const POST = route("auth.reset", async (req) => {
  const parsed = schema.safeParse(await readJson(req));
  if (!parsed.success) throw badRequest(parsed.error.issues[0]?.message ?? "Invalid request.");

  const row = await q1<Row>(
    `SELECT * FROM password_resets WHERE token_hash = ? AND used_at IS NULL AND expires_at > ?`,
    [sha256(parsed.data.token), nowIso()],
  );
  if (!row) throw badRequest("This reset link is invalid or has expired. Request a new one.");

  await run(`UPDATE users SET password_hash = ?, updated_at = ? WHERE id = ?`, [
    hashPassword(parsed.data.password),
    nowIso(),
    row.user_id,
  ]);
  await run(`UPDATE password_resets SET used_at = ? WHERE id = ?`, [nowIso(), row.id]);
  await run(`DELETE FROM sessions WHERE user_id = ?`, [row.user_id]);

  return json({ ok: true, message: "Password updated. You can sign in now." });
});
