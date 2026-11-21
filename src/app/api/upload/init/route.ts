import crypto from "node:crypto";
import path from "node:path";
import fs from "node:fs/promises";
import { z } from "zod";
import { badRequest, json, readJson, requireUser, route } from "@/lib/api";
import { absPath, ensureDir } from "@/lib/storage";
import { env } from "@/lib/env";

const initSchema = z.object({
  fileName: z.string().min(1).max(255),
  size: z.number().int().positive(),
  mimeType: z.string().max(120).optional(),
});

const UPLOAD_ROOT = "uploads";

/**
 * Chunked upload — step 1.
 * Videos are streamed to disk in 8 MB chunks so multi-GB sources never sit in RAM.
 */
export const POST = route("upload.init", async (req) => {
  const user = await requireUser();
  const parsed = initSchema.safeParse(await readJson(req));
  if (!parsed.success) throw badRequest("Invalid upload.");

  const { fileName, size } = parsed.data;
  if (size > env.maxUploadBytes) {
    throw badRequest(
      `That file is ${(size / 1024 / 1024 / 1024).toFixed(2)} GB — the limit is ${(
        env.maxUploadBytes /
        1024 /
        1024 /
        1024
      ).toFixed(1)} GB.`,
    );
  }
  const ext = path.extname(fileName).toLowerCase();
  if (![".mp4", ".mov", ".m4v", ".webm", ".mkv", ".avi"].includes(ext)) {
    throw badRequest("Upload an MP4, MOV, WEBM, MKV or AVI file.");
  }

  const uploadId = crypto.randomUUID();
  const dir = absPath(path.posix.join(UPLOAD_ROOT, uploadId));
  await ensureDir(dir);
  await fs.writeFile(
    path.join(dir, "meta.json"),
    JSON.stringify({ userId: user.id, fileName, size, ext, createdAt: new Date().toISOString() }),
  );
  return json({ uploadId, chunkSize: 8 * 1024 * 1024 });
});
