/**
 * Copies a local SQLite database into the configured PostgreSQL / Supabase
 * database (DATABASE_URL). Media files are *not* moved — they stay in
 * STORAGE_DIR and the stored relative paths keep working.
 *
 *   npx tsx scripts/copy-sqlite-to-postgres.ts [--force]
 *
 * Without --force it refuses to run when the target already has users.
 */
import os from "node:os";
import path from "node:path";
import { env } from "../src/lib/env";
import { db, q1, run } from "../src/lib/db";

const TABLES = [
  "users",
  "projects",
  "clips",
  "jobs",
  "job_logs",
  "exports",
  "usage_events",
  "user_settings",
  "error_logs",
  "admin_audit",
] as const;

const force = process.argv.includes("--force");

async function main() {
  if (!env.databaseUrl) {
    throw new Error("DATABASE_URL is empty — set it to your Postgres/Supabase connection string first.");
  }
  const sqliteFile = path.resolve(env.sqlitePath);
  let Database: any;
  try {
    Database = require("better-sqlite3");
  } catch {
    throw new Error("better-sqlite3 is not installed.");
  }
  const source = new Database(sqliteFile, { readonly: true });
  console.log(`source  ${sqliteFile} (${os.platform()})`);
  console.log(`target  ${env.databaseUrl.replace(/:\/\/[^@]+@/, "://***@")}`);

  const target = await db();
  console.log(`driver  ${target.name}`);

  const existing = await q1<{ n: number }>(`SELECT COUNT(*) AS n FROM users`);
  if (Number(existing?.n ?? 0) > 0 && !force) {
    console.log(`target already has ${existing?.n} user(s) — re-run with --force to overwrite.`);
    return;
  }

  for (const table of TABLES) {
    const rows = source.prepare(`SELECT * FROM ${table}`).all() as Record<string, any>[];
    await run(`DELETE FROM ${table}`);
    let copied = 0;
    for (const row of rows) {
      const columns = Object.keys(row);
      const placeholders = columns.map(() => "?").join(", ");
      await run(
        `INSERT INTO ${table} (${columns.join(", ")}) VALUES (${placeholders})`,
        columns.map((c) => (row[c] === undefined ? null : row[c])),
      );
      copied += 1;
    }
    console.log(`  ${table.padEnd(14)} ${copied}`);
  }

  source.close();
  console.log("done — restart the app and worker to use the new database");
  process.exit(0);
}

main().catch((err) => {
  console.error(String(err?.message ?? err));
  process.exit(1);
});
