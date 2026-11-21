/** Local filesystem storage driver (Supabase/S3 adapter documented in README). */
import fs from "node:fs/promises";
import path from "node:path";
import { q } from "./db";
import crypto from "node:crypto";
import { env } from "./env";

export const STORAGE_ROOT = path.resolve(env.storageDir);

export function absPath(relative: string): string {
  const clean = relative.replace(/^\/+/, "").replace(/\.\./g, "");
  return path.join(STORAGE_ROOT, clean);
}

export async function ensureDir(dir: string) {
  await fs.mkdir(dir, { recursive: true });
}

export function projectDir(projectId: string) {
  return path.join("projects", projectId);
}

/** Returns a storage-relative path (safe to persist in the DB). */
export async function newTempFile(prefix: string, ext: string): Promise<string> {
  const rel = path.join("tmp", `${prefix}-${crypto.randomUUID()}${ext}`);
  await ensureDir(path.dirname(absPath(rel)));
  return rel;
}

export async function writeFileRel(rel: string, data: Buffer | string) {
  const target = absPath(rel);
  await ensureDir(path.dirname(target));
  await fs.writeFile(target, data);
  return rel;
}

export async function readFileRel(rel: string): Promise<Buffer> {
  return fs.readFile(absPath(rel));
}

export async function statRel(rel: string) {
  return fs.stat(absPath(rel));
}

export async function existsRel(rel: string): Promise<boolean> {
  try {
    await fs.access(absPath(rel));
    return true;
  } catch {
    return false;
  }
}

export async function removeRel(rel: string) {
  await fs.rm(absPath(rel), { recursive: true, force: true });
}

export async function dirSizeRel(rel: string): Promise<number> {
  const target = absPath(rel);
  let total = 0;
  async function walk(dir: string) {
    let entries;
    try {
      entries = await fs.readdir(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) await walk(full);
      else total += (await fs.stat(full)).size;
    }
  }
  await walk(target);
  return total;
}

/**
 * Sums every byte this user owns: one directory per project (source, frames,
 * renders) plus any saved thumbnails/exports. Media lives under
 * `projects/<projectId>/…`, so the ids come from the database.
 */
export async function userStorageBytes(userId: string): Promise<number> {
  const rows = await q<{ id: string }>(`SELECT id FROM projects WHERE user_id = ?`, [userId]);
  let total = 0;
  for (const row of rows) {
    total += await dirSizeRel(path.join("projects", row.id));
  }
  return total;
}
