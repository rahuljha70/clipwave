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
import { env } from "./env";

export type SqlValue = string | number | null | boolean;
export type Row = Record<string, any>;

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

function createSqliteDriver(file: string): Driver {
  const Database = require("better-sqlite3");
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

function createPostgresDriver(url: string): Driver {
  const { Pool } = require("pg");
  const pool = new Pool({
    connectionString: url,
    max: Number(process.env.PG_POOL_MAX ?? 10),
    ssl: /supabase|sslmode=require/.test(url) ? { rejectUnauthorized: false } : undefined,
  });

  const binder = (client: any): Driver => ({
    name: "postgres",
    async all<T>(sql: string, params: SqlValue[] = []) {
      const res = await client.query(toPgPlaceholders(sql), normalize(params));
      return res.rows as T[];
    },
    async get<T>(sql: string, params: SqlValue[] = []) {
      const res = await client.query(toPgPlaceholders(sql), normalize(params));
      return (res.rows[0] ?? null) as T | null;
    },
    async run(sql: string, params: SqlValue[] = []) {
      const res = await client.query(toPgPlaceholders(sql), normalize(params));
      return { changes: res.rowCount ?? 0 };
    },
    async exec(sql: string) {
      await client.query(sql);
    },
    async close() {
      /* the pool owns the connection */
    },
    async withTransaction<T>(fn: (d: Driver) => Promise<T>) {
      return fn(binder(client));
    },
  });

  return {
    ...binder(null),
    async all<T>(sql: string, params: SqlValue[] = []) {
      const res = await pool.query(toPgPlaceholders(sql), normalize(params));
      return res.rows as T[];
    },
    async get<T>(sql: string, params: SqlValue[] = []) {
      const res = await pool.query(toPgPlaceholders(sql), normalize(params));
      return (res.rows[0] ?? null) as T | null;
    },
    async run(sql: string, params: SqlValue[] = []) {
      const res = await pool.query(toPgPlaceholders(sql), normalize(params));
      return { changes: res.rowCount ?? 0 };
    },
    async exec(sql: string) {
      await pool.query(sql);
    },
    async close() {
      await pool.end();
    },
    /**
     * pgbouncer/BEGIN must happen on one connection, so borrow a client for the
     * whole transaction instead of round-tripping through the pool.
     */
    async withTransaction<T>(fn: (d: Driver) => Promise<T>) {
      const client = await pool.connect();
      try {
        await client.query("BEGIN");
        const out = await fn(binder(client));
        await client.query("COMMIT");
        return out;
      } catch (err) {
        try {
          await client.query("ROLLBACK");
        } catch {
          /* connection already gone */
        }
        throw err;
      } finally {
        client.release();
      }
    },
  };
}

/* -------------------------------------------------------------------------- */
/* Singleton + migrations                                                      */
/* -------------------------------------------------------------------------- */

declare global {
  // eslint-disable-next-line no-var
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
    ? createPostgresDriver(env.databaseUrl)
    : createSqliteDriver(env.sqlitePath);

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
        } catch (err: any) {
          // CREATE INDEX IF NOT EXISTS etc. are idempotent; ignore "already exists".
          if (!/already exists|duplicate/i.test(String(err?.message))) throw err;
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
