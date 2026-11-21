import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { z } from "zod";
import { badRequest, json, notFound, readJson, requireUser, route } from "@/lib/api";
import { absPath, ensureDir } from "@/lib/storage";
import { probe } from "@/lib/media/ffmpeg";
import { nowIso, run } from "@/lib/db";
import { assertCanProcess, clipsAllowed, getUsage } from "@/lib/entitlements";
import { getEffectivePlan } from "@/lib/plans";
import { enqueue } from "@/lib/jobs";
import { storageProjectPath } from "@/lib/paths";

type Ctx = { params: Promise<{ id: string }> };

const schema = z.object({
  title: z.string().min(1).max(200).optional(),
  targetLength: z.number().int().min(10).max(180).default(30),
  requestedClips: z.number().int().min(1).max(2_147_483_647).default(8),
  aspect: z.enum(["9:16", "16:9", "1:1"]).default("9:16"),
  subtitleStyle: z.string().default("mrbeast"),
});

/** Chunked upload — step 3: validate the file, create the project and queue it. */
export const POST = route<Ctx>("upload.complete", async (req, ctx) => {
  const { id } = await ctx.params;
  const user = await requireUser();
  const isAdmin = user.role === "admin";
  const parsed = schema.safeParse(await readJson(req).catch(() => ({})));
  if (!parsed.success) throw badRequest("Invalid project settings.");

  const dir = absPath(path.posix.join("uploads", id));
  let meta;
  try {
    meta = JSON.parse(await fs.readFile(path.join(dir, "meta.json"), "utf8"));
  } catch {
    throw notFound("Upload session not found.");
  }
  if (meta.userId !== user.id) throw badRequest("This upload belongs to another account.");

  const file = path.join(dir, `source${meta.ext}`);
  const stat = await fs.stat(file).catch(() => null);
  if (!stat) throw badRequest("No data received for this upload.");
  if (stat.size < 1024 * 20) throw badRequest("That file is too small to be a video.");

  const info = await probe(file).catch(() => null);
  if (!info || !info.durationSec) throw badRequest("We could not read that file as a video.");

  await assertCanProcess(user.id, user.plan, info.durationSec, isAdmin);
  const plan = getEffectivePlan(user.plan, isAdmin);
  const usage = await getUsage(user.id, user.plan, isAdmin);
  if (!usage.isUnlimited && usage.remainingSeconds <= 0) {
    return json({ error: "You have used all processing minutes this month.", code: "quota" }, 402);
  }

  const projectId = crypto.randomUUID();
  const projectDir = absPath(storageProjectPath(projectId));
  await ensureDir(projectDir);
  const mediaRel = path.posix.join(storageProjectPath(projectId), `source${meta.ext}`);
  await fs.rename(file, absPath(mediaRel)).catch(async () => {
    await fs.copyFile(file, absPath(mediaRel));
    await fs.rm(file, { force: true });
  });
  await fs.rm(dir, { recursive: true, force: true });

  const ts = nowIso();
  const requested = clipsAllowed(plan, parsed.data.requestedClips, isAdmin);
  const title = parsed.data.title ?? meta.fileName.replace(/\.[^.]+$/, "");

  await run(
    `INSERT INTO projects (id, user_id, title, source_type, platform, channel, thumbnail_url, duration_sec,
                           status, stage, progress, target_length, aspect, requested_clips, media_path,
                           analysis_json, created_at, updated_at)
     VALUES (?, ?, ?, 'upload', 'upload', NULL, NULL, ?, 'queued', 'Queued for processing', 0, ?, ?, ?, ?, ?, ?, ?)`,
    [
      projectId,
      user.id,
      title,
      info.durationSec,
      parsed.data.targetLength,
      parsed.data.aspect,
      requested,
      mediaRel,
      JSON.stringify({ subtitleStyle: parsed.data.subtitleStyle, source: meta.fileName }),
      ts,
      ts,
    ],
  );

  const jobId = await enqueue({
    type: "process_project",
    projectId,
    userId: user.id,
    priority: plan.priority,
  });

  return json({ projectId, jobId, durationSec: info.durationSec, requestedClips: requested }, 201);
});
