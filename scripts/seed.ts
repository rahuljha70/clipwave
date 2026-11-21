/**
 * Bootstraps accounts: an administrator plus (optionally) a demo user.
 *   npm run seed
 * Safe to run repeatedly — existing accounts are left untouched.
 */
import { env } from "../src/lib/env";
import { hashPassword } from "../src/lib/auth-crypto";
import { nowIso, q1, run, type Row } from "../src/lib/db";
import crypto from "node:crypto";

async function ensureUser(input: {
  email: string;
  password: string;
  name: string;
  role?: "user" | "admin";
  plan?: "free" | "pro" | "ultimate";
}) {
  const existing = await q1<Row>(`SELECT id FROM users WHERE email = ?`, [input.email.toLowerCase()]);
  if (existing) {
    if (input.role === "admin") {
      await run(
        `UPDATE users SET role = 'admin', plan = ?, plan_status = 'active', plan_renews_at = NULL, updated_at = ? WHERE id = ?`,
        [input.plan ?? "ultimate", nowIso(), existing.id],
      );
      console.log(`  ↻ ${input.email} already existed — ensured admin role`);
    } else {
      console.log(`  · ${input.email} already exists`);
    }
    return existing.id;
  }
  const id = crypto.randomUUID();
  const ts = nowIso();
  await run(
    `INSERT INTO users (id, email, password_hash, name, role, plan, plan_status, provider, email_verified, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, 'active', 'password', 1, ?, ?)`,
    [
      id,
      input.email.toLowerCase(),
      hashPassword(input.password),
      input.name,
      input.role ?? "user",
      input.plan ?? "free",
      ts,
      ts,
    ],
  );
  console.log(`  ✓ created ${input.role ?? "user"} ${input.email} (${input.plan ?? "free"})`);
  return id;
}

async function main() {
  console.log("Clipwave seed");
  await ensureUser({
    email: env.adminEmail,
    password: env.adminPassword,
    name: "Clipwave Admin",
    role: "admin",
    plan: "ultimate",
  });

  if ((process.env.SEED_DEMO_USER ?? "true") !== "false") {
    await ensureUser({
      email: process.env.DEMO_EMAIL ?? "demo@clipwave.app",
      password: process.env.DEMO_PASSWORD ?? "demo12345",
      name: "Demo Creator",
      role: "user",
      plan: "pro",
    });
  }
  console.log("Done. Start the app with `npm run dev:all`.");
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
