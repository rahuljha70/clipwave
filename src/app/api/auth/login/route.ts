import { z } from "zod";
import { badRequest, clientIp, json, readJson, route, unauthorized } from "@/lib/api";
import { createSession, publicUser, setSessionCookie, verifyPassword } from "@/lib/auth";
import { q1, type Row } from "@/lib/db";

const schema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export const POST = route("auth.login", async (req) => {
  const parsed = schema.safeParse(await readJson(req));
  if (!parsed.success) throw badRequest("Enter your email and password.");

  const row = await q1<Row>(`SELECT * FROM users WHERE email = ?`, [
    parsed.data.email.toLowerCase(),
  ]);
  if (!row || !verifyPassword(parsed.data.password, row.password_hash)) {
    throw unauthorized("Email or password is incorrect.");
  }

  const { token, expiresAt } = await createSession(row.id, {
    userAgent: req.headers.get("user-agent") ?? undefined,
    ip: clientIp(req),
  });
  await setSessionCookie(token, expiresAt);

  return json({
    user: publicUser({
      id: row.id,
      email: row.email,
      name: row.name,
      avatar_url: row.avatar_url,
      role: row.role,
      plan: row.plan,
      plan_status: row.plan_status,
      plan_renews_at: row.plan_renews_at,
      provider: row.provider,
      created_at: row.created_at,
    }),
  });
});
