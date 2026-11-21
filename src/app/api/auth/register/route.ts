import { z } from "zod";
import { badRequest, clientIp, json, readJson, route } from "@/lib/api";
import { createSession, publicUser, registerUser, setSessionCookie } from "@/lib/auth";
import { nowIso, q1, run, type Row } from "@/lib/db";

const schema = z.object({
  email: z.string().email("Enter a valid email address."),
  password: z.string().min(8, "Use at least 8 characters."),
  name: z.string().min(1).max(80).optional(),
});

export const POST = route("auth.register", async (req) => {
  const body = await readJson(req);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    throw badRequest(parsed.error.issues[0]?.message ?? "Invalid details.");
  }
  const email = parsed.data.email.toLowerCase();
  const existing = await q1<Row>(`SELECT id FROM users WHERE email = ?`, [email]);
  if (existing) throw badRequest("An account with this email already exists. Try signing in.");

  const userId = await registerUser({
    email,
    password: parsed.data.password,
    name: parsed.data.name ?? email.split("@")[0],
  });

  const { token, expiresAt } = await createSession(userId, {
    userAgent: req.headers.get("user-agent") ?? undefined,
    ip: clientIp(req),
  });
  await setSessionCookie(token, expiresAt);
  await run(`UPDATE users SET updated_at = ? WHERE id = ?`, [nowIso(), userId]);

  const user = await q1<Row>(`SELECT * FROM users WHERE id = ?`, [userId]);
  return json(
    {
      user: publicUser({
        id: user!.id,
        email: user!.email,
        name: user!.name,
        avatar_url: user!.avatar_url,
        role: user!.role,
        plan: user!.plan,
        plan_status: user!.plan_status,
        plan_renews_at: user!.plan_renews_at,
        provider: user!.provider,
        created_at: user!.created_at,
      }),
    },
    201,
  );
});
