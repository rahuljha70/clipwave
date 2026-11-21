import crypto from "node:crypto";
import { z } from "zod";
import { badRequest, json, readJson, route } from "@/lib/api";
import { randomToken, sha256 } from "@/lib/auth";
import { nowIso, q1, run, type Row } from "@/lib/db";
import { env, isProd } from "@/lib/env";
import { sendMail } from "@/lib/mailer";

const schema = z.object({ email: z.string().email() });

export const POST = route("auth.forgot", async (req) => {
  const parsed = schema.safeParse(await readJson(req));
  if (!parsed.success) throw badRequest("Enter a valid email address.");

  const row = await q1<Row>(`SELECT id, email, name FROM users WHERE email = ?`, [
    parsed.data.email.toLowerCase(),
  ]);

  // Always answer the same way so the endpoint cannot be used to enumerate users.
  const response: Record<string, unknown> = {
    ok: true,
    message: "If that email is registered, a reset link is on its way.",
  };

  if (row) {
    const token = randomToken();
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000).toISOString();
    await run(
      `INSERT INTO password_resets (id, user_id, token_hash, expires_at, created_at) VALUES (?, ?, ?, ?, ?)`,
      [crypto.randomUUID(), row.id, sha256(token), expiresAt, nowIso()],
    );
    const link = `${env.appUrl}/reset-password?token=${token}`;
    const result = await sendMail({
      to: row.email,
      subject: "Reset your Clipwave password",
      html: `<p>Hi ${row.name ?? "there"},</p><p>Reset your Clipwave password with the link below. It expires in 60 minutes.</p><p><a href="${link}">${link}</a></p><p>If you didn't request this, you can ignore this email.</p>`,
      text: `Reset your Clipwave password: ${link}`,
    });
    // In development without an email provider, surface the link so the flow is testable.
    if (!isProd && result.transport === "outbox") response.devResetUrl = link;
  }

  return json(response);
});
