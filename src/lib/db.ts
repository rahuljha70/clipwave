/**
 * Database layer.
 *
 * One query API, two drivers:
 *  - PostgreSQL / Supabase when DATABASE_URL is set (production).
 *  - SQLite (better-sqlite3) otherwise, so `npm run dev` works with zero setup.
 *
 * All SQL in this project is written with `?` placeholders and only portable
 * column types, so the same statements run on both engines.
 */
import fs from "node:fs";
import path from "node:path";
import type { PoolClient, QueryResultRow } from "pg";
import { env } from "./env";

export type SqlValue = string | number | null | boolean;
export type Row = QueryResultRow;

export interface Driver {
  name: "sqlite" | "postgres";
  /** Runs `fn` on a single dedicated connection so BEGIN/COMMIT are atomic. */
  withTransaction?<T>(fn: (d: Driver) => Promise<T>): Promise<T>;
  all<T = Row>(sql: string, params?: SqlValue[]): Promise<T[]>;
  get<T = Row>(sql: string, params?: SqlValue[]): Promise<T | null>;
  run(sql: string, params?: SqlValue[]): Promise<{ changes: number }>;
  exec(sql: string): Promise<void>;
  close(): Promise<void>;
}

function normalize(params: SqlValue[] = []): SqlValue[] {
  return params.map((p) => (typeof p === "boolean" ? (p ? 1 : 0) : p));
}

/* -------------------------------------------------------------------------- */
/* SQLite                                                                      */
/* -------------------------------------------------------------------------- */

async function createSqliteDriver(file: string): Promise<Driver> {
  const { default: Database } = await import("better-sqlite3");
  fs.mkdirSync(path.dirname(path.resolve(file)), { recursive: true });
  const db = new Database(path.resolve(file));
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");
  db.pragma("busy_timeout = 5000");

  return {
    name: "sqlite",
    async all<T>(sql: string, params: SqlValue[] = []) {
      return db.prepare(sql).all(...normalize(params)) as T[];
    },
    async get<T>(sql: string, params: SqlValue[] = []) {
      const row = db.prepare(sql).get(...normalize(params));
      return (row ?? null) as T | null;
    },
    async run(sql: string, params: SqlValue[] = []) {
      const info = db.prepare(sql).run(...normalize(params));
      return { changes: info.changes };
    },
    async exec(sql: string) {
      db.exec(sql);
    },
    async close() {
      db.close();
    },
  };
}

/* -------------------------------------------------------------------------- */
/* PostgreSQL / Supabase                                                       */
/* -------------------------------------------------------------------------- */

function toPgPlaceholders(sql: string): string {
  let i = 0;
  return sql.replace(/\?/g, () => `$${++i}`);
}

async function createPostgresDriver(url: string): Promise<Driver> {
  const { Pool } = await import("pg");
  const pool = new Pool({
    connectionString: url,
    max: Number(process.env.PG_POOL_MAX ?? 10),
    ssl: /supabase|sslmode=require/.test(url) ? { rejectUnauthorized: false } : undefined,
  });

  const binder = (client?: PoolClient): Driver => ({
    name: "postgres",
    async all<T>(sql: string, params: SqlValue[] = []) {
      const query = toPgPlaceholders(sql);
      const values = normalize(params);
      const res = client ? await client.query(query, values) : await pool.query(query, values);
      return res.rows as T[];
    },
    async get<T>(sql: string, params: SqlValue[] = []) {
      const query = toPgPlaceholders(sql);
      const values = normalize(params);
      const res = client ? await client.query(query, values) : await pool.query(query, values);
      return (res.rows[0] ?? null) as T | null;
    },
    async run(sql: string, params: SqlValue[] = []) {
      const query = toPgPlaceholders(sql);
      const values = normalize(params);
      const res = client ? await client.query(query, values) : await pool.query(query, values);
      return { changes: res.rowCount ?? 0 };
    },
    async exec(sql: string) {
      if (client) await client.query(sql);
      else await pool.query(sql);
    },
    async close() {
      if (!client) await pool.end();
    },
    async withTransaction<T>(fn: (d: Driver) => Promise<T>) {
      if (client) return fn(binder(client));
      const transactionClient = await pool.connect();
      try {
        await transactionClient.query("BEGIN");
        const result = await fn(binder(transactionClient));
        await transactionClient.query("COMMIT");
        return result;
      } catch (error) {
        try {
          await transactionClient.query("ROLLBACK");
        } catch {
          /* connection already gone */
        }
        throw error;
      } finally {
        transactionClient.release();
      }
    },
  });

  return binder();
}

/* -------------------------------------------------------------------------- */
/* Singleton + migrations                                                      */
/* -------------------------------------------------------------------------- */

declare global {
  var __clipwaveDb: Promise<Driver> | undefined;
}

function migrateSqlStatements(sql: string): string[] {
  return sql
    .replace(/^\s*--.*$/gm, "")
    .split(/;\s*(?:\r?\n|$)/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

async function init(): Promise<Driver> {
  const driver = env.databaseUrl
    ? await createPostgresDriver(env.databaseUrl)
    : await createSqliteDriver(env.sqlitePath);

  // Netlify Database applies the files in netlify/database/migrations before a
  // deploy is published. Its runtime role is intentionally not allowed to run
  // DDL, so skip the app-managed migration table in that deployment mode.
  if (
    driver.name === "postgres" &&
    process.env.CLIPWAVE_MANAGED_MIGRATIONS === "true"
  ) {
    return driver;
  }

  await driver.exec(
    `CREATE TABLE IF NOT EXISTS _migrations (name TEXT PRIMARY KEY, applied_at TEXT NOT NULL)`,
  );

  const dir = path.resolve("db/migrations");
  if (fs.existsSync(dir)) {
    const files = fs.readdirSync(dir).filter((f) => f.endsWith(".sql")).sort();
    for (const file of files) {
      const done = await driver.get(`SELECT name FROM _migrations WHERE name = ?`, [file]);
      if (done) continue;
      const sql = fs.readFileSync(path.join(dir, file), "utf8");
      for (const statement of migrateSqlStatements(sql)) {
        try {
          await driver.exec(statement);
        } catch (error: unknown) {
          // CREATE INDEX IF NOT EXISTS etc. are idempotent; ignore "already exists".
          const message = error instanceof Error ? error.message : String(error);
          if (!/already exists|duplicate/i.test(message)) throw error;
        }
      }
      await driver.run(`INSERT INTO _migrations (name, applied_at) VALUES (?, ?)`, [
        file,
        new Date().toISOString(),
      ]);
    }
  }
  return driver;
}

export function db(): Promise<Driver> {
  if (!globalThis.__clipwaveDb) globalThis.__clipwaveDb = init();
  return globalThis.__clipwaveDb;
}

/** Convenience helpers — the shapes used across the app. */
export async function q<T = Row>(sql: string, params: SqlValue[] = []): Promise<T[]> {
  return (await db()).all<T>(sql, params);
}
export async function q1<T = Row>(sql: string, params: SqlValue[] = []): Promise<T | null> {
  return (await db()).get<T>(sql, params);
}
export async function run(sql: string, params: SqlValue[] = []): Promise<number> {
  return (await db()).run(sql, params).then((r) => r.changes);
}

export async function transaction<T>(fn: (d: Driver) => Promise<T>): Promise<T> {
  const d = await db();
  if (d.name === "postgres") {
    if (d.withTransaction) return d.withTransaction(fn);
    return fn(d);
  }
  await d.exec("BEGIN IMMEDIATE");
  try {
    const out = await fn(d);
    await d.exec("COMMIT");
    return out;
  } catch (err) {
    await d.exec("ROLLBACK");
    throw err;
  }
}

export function nowIso(): string {
  return new Date().toISOString();
}

export function parseJson<T>(value: string | null | undefined, fallback: T): T {
  if (!value) return fallback;
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}
