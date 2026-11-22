import crypto from "node:crypto";
import { z } from "zod";
import { badRequest, json, readJson, requireUser, route } from "@/lib/api";
import { nowIso, q, q1, run, type Row } from "@/lib/db";
import { getEffectivePlan } from "@/lib/plans";
import { assertCanProcess, clipsAllowed, getUsage } from "@/lib/entitlements";
import { resolveSource, SourceError } from "@/lib/sources";
import { enqueue } from "@/lib/jobs";
import { projectToDto } from "@/lib/serializers";

const createSchema = z.object({
  url: z.string().min(3).max(600),
  targetLength: z.number().int().min(10).max(180).default(30),
  requestedClips: z.number().int().min(1).max(2_147_483_647).default(8),
  aspect: z.enum(["9:16", "16:9", "1:1"]).default("9:16"),
  subtitleStyle: z.string().default("mrbeast"),
  language: z.string().max(10).optional(),
});

export const GET = route("projects.list", async (req) => {
  const user = await requireUser();
  const url = new URL(req.url);
  const status = url.searchParams.get("status");
  const limit = Math.min(100, Number(url.searchParams.get("limit") ?? 50));
  const rows = await q<Row>(
    `SELECT p.*, (SELECT COUNT(*) FROM clips c WHERE c.project_id = p.id AND c.status = 'ready') AS ready_clips
       FROM projects p
      WHERE p.user_id = ? ${status ? "AND p.status = ?" : ""}
      ORDER BY p.created_at DESC LIMIT ?`,
    status ? [user.id, status, limit] : [user.id, limit],
  );
  return json({ projects: rows.map(projectToDto) });
});

export const POST = route("projects.create", async (req) => {
  const user = await requireUser();
  const isAdmin = user.role === "admin";
  const parsed = createSchema.safeParse(await readJson(req));
  if (!parsed.success) throw badRequest(parsed.error.issues[0]?.message ?? "Invalid project settings.");
  const input = parsed.data;

  let meta;
  try {
    meta = await resolveSource(input.url);
  } catch (error) {
    if (error instanceof SourceError) return json({ error: error.message, code: error.code }, 422);
    throw error;
  }

  // Guard rails: plan limits + monthly credit allowance are enforced here.
  if (meta.durationSec > 0) await assertCanProcess(user.id, user.plan, meta.durationSec, isAdmin);
  const plan = getEffectivePlan(user.plan, isAdmin);
  const usage = await getUsage(user.id, user.plan, isAdmin);
  if (!usage.isUnlimited && usage.remainingSeconds <= 0) {
    return json(
      { error: "You have used all processing minutes for this month.", code: "quota" },
      402,
    );
  }

  const active = await q1<Row>(
    `SELECT COUNT(*) AS n FROM projects WHERE user_id = ? AND status IN ('queued','processing')`,
    [user.id],
  );
  const maxActive = plan.id === "free" ? 1 : plan.id === "pro" ? 3 : 8;
  if (!isAdmin && Number(active?.n ?? 0) >= maxActive) {
    return json(
      {
        error: `You already have ${maxActive} project(s) processing. Wait for them to finish or upgrade for more parallel jobs.`,
        code: "busy",
      },
      429,
    );
  }

  const projectId = crypto.randomUUID();
  const ts = nowIso();
  const requested = clipsAllowed(plan, input.requestedClips, isAdmin);

  await run(
    `INSERT INTO projects (id, user_id, title, source_type, source_url, platform, source_id, channel,
                           thumbnail_url, description, duration_sec, status, stage, progress, target_length,
                           aspect, requested_clips, created_at, updated_at)
     VALUES (?, ?, ?, 'url', ?, ?, ?, ?, ?, ?, ?, 'queued', 'Queued for processing', 0, ?, ?, ?, ?, ?)`,
    [
      projectId,
      user.id,
      meta.title,
      meta.url,
      meta.platform,
      meta.sourceId,
      meta.channel,
      meta.thumbnailUrl,
      meta.description ?? null,
      meta.durationSec,
      input.targetLength,
      input.aspect,
      requested,
      ts,
      ts,
    ],
  );

  // Store per-project preferences (subtitle style is applied at render time).
  await run(`UPDATE projects SET analysis_json = ? WHERE id = ?`, [
    JSON.stringify({ subtitleStyle: input.subtitleStyle, language: input.language ?? "auto" }),
    projectId,
  ]);

  const jobId = await enqueue({
    type: "process_project",
    projectId,
    userId: user.id,
    priority: plan.priority,
  });

  return json({ projectId, jobId, source: meta, requestedClips: requested }, 201);
});
