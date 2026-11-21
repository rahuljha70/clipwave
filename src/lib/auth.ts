/** Password hashing (scrypt), session tokens and the auth guards used by routes. */
import crypto from "node:crypto";
import {
  hashPassword,
  randomToken,
  sha256,
  verifyPassword,
} from "./auth-crypto";
import { cookies } from "next/headers";
import { env } from "./env";
import { nowIso, q1, run, type Row } from "./db";

export const SESSION_COOKIE = "cw_session";

/* ------------------------------- passwords -------------------------------- */
// Re-exported from auth-crypto so CLI scripts can use the same primitives.
export { hashPassword, verifyPassword, randomToken, sha256 } from "./auth-crypto";

/* ------------------------------- sessions --------------------------------- */

export interface SessionUser {
  id: string;
  email: string;
  name: string | null;
  avatar_url: string | null;
  role: "user" | "admin";
  plan: "free" | "pro" | "ultimate";
  plan_status: string;
  plan_renews_at: string | null;
  provider: string;
  created_at: string;
}

export async function createSession(
  userId: string,
  meta: { userAgent?: string; ip?: string } = {},
): Promise<{ token: string; expiresAt: string }> {
  const token = randomToken();
  const expiresAt = new Date(
    Date.now() + env.sessionTtlDays * 24 * 60 * 60 * 1000,
  ).toISOString();
  await run(
    `INSERT INTO sessions (id, user_id, token_hash, user_agent, ip, expires_at, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [
      crypto.randomUUID(),
      userId,
      sha256(token),
      meta.userAgent ?? null,
      meta.ip ?? null,
      expiresAt,
      nowIso(),
    ],
  );
  return { token, expiresAt };
}

export async function setSessionCookie(token: string, expiresAt: string) {
  const jar = await cookies();
  jar.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    expires: new Date(expiresAt),
  });
}

export async function clearSessionCookie() {
  const jar = await cookies();
  jar.set(SESSION_COOKIE, "", { httpOnly: true, path: "/", maxAge: 0 });
}

export async function getSessionUser(): Promise<SessionUser | null> {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  const row = await q1<Row & SessionUser>(
    `SELECT u.id, u.email, u.name, u.avatar_url, u.role, u.plan, u.plan_status,
            u.plan_renews_at, u.provider, u.created_at
       FROM sessions s JOIN users u ON u.id = s.user_id
      WHERE s.token_hash = ? AND s.expires_at > ?`,
    [sha256(token), nowIso()],
  );
  return (row as SessionUser) ?? null;
}

export async function destroyCurrentSession() {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (token) await run(`DELETE FROM sessions WHERE token_hash = ?`, [sha256(token)]);
  await clearSessionCookie();
}

export async function registerUser(input: {
  email: string;
  password?: string;
  name?: string;
  provider?: "password" | "google";
  googleSub?: string;
  avatarUrl?: string;
  role?: "user" | "admin";
}): Promise<string> {
  const id = crypto.randomUUID();
  const ts = nowIso();
  await run(
    `INSERT INTO users (id, email, password_hash, name, avatar_url, role, plan, plan_status,
                        provider, google_sub, email_verified, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, 'free', 'active', ?, ?, ?, ?, ?)`,
    [
      id,
      input.email.toLowerCase(),
      input.password ? hashPassword(input.password) : null,
      input.name ?? null,
      input.avatarUrl ?? null,
      input.role ?? "user",
      input.provider ?? "password",
      input.googleSub ?? null,
      input.provider === "google" ? 1 : 0,
      ts,
      ts,
    ],
  );
  return id;
}

export function publicUser(u: SessionUser) {
  return {
    id: u.id,
    email: u.email,
    name: u.name,
    avatarUrl: u.avatar_url,
    role: u.role,
    plan: u.plan,
    planStatus: u.plan_status,
    planRenewsAt: u.plan_renews_at,
    provider: u.provider,
    createdAt: u.created_at,
  };
}
