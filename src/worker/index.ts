/**
 * Clipwave background worker.
 *
 *   npm run worker
 *
 * Claims jobs from the database queue and runs the heavy work: downloading,
 * Whisper transcription, acoustic analysis, ffmpeg rendering, SEO + thumbnails.
 * Scale horizontally by running more workers (WORKER_CONCURRENCY / replicas).
 */
import os from "node:os";
import crypto from "node:crypto";
import { env } from "../lib/env";
import { nowIso, q1, run, type Row } from "../lib/db";
import { claimNext, recordJobLog, requeueStaleJobs, touchJob, updateJob } from "../lib/jobs";
import { processProject, rerenderClip } from "../lib/pipeline";
import { generateSeo } from "../lib/ai/seo";
import { llmEnabled } from "../lib/env";
import { momentFromClip } from "../lib/clip-utils";
import { errorMessage } from "../lib/utils";

const WORKER_ID = `${os.hostname()}-${crypto.randomBytes(4).toString("hex")}`;
let running = true;
let activeJobs = 0;

function log(message: string) {
  console.log(`[worker ${new Date().toISOString().slice(11, 19)}] ${message}`);
}

async function runJob(job: Row) {
  const jobId = String(job.id);
  const payload = job.payload_json ? JSON.parse(job.payload_json) : {};
  log(`▶ ${job.type} ${jobId}`);

  const jobLog = async (message: string) => {
    await recordJobLog(jobId, message);
    await updateJob(jobId, { stage: message });
    log(`   ${message}`);
  };

  const heartbeat = setInterval(() => {
    void touchJob(jobId).catch(() => {});
  }, 30_000);

  try {
    if (job.type === "process_project") {
      if (!job.project_id) throw new Error("process_project job requires project_id");
      await processProject(String(job.project_id), jobLog);
      await updateJob(jobId, { status: "done", progress: 100 });
    } else if (job.type === "render_clip") {
      const clipId = String(payload.clipId ?? "");
      if (!clipId) throw new Error("render_clip job requires payload.clipId");
      await jobLog("Re-rendering clip with your edits");
      await rerenderClip(clipId, payload.overrides ?? {}, jobLog);
      await updateJob(jobId, { status: "done", progress: 100 });
    } else if (job.type === "regenerate_seo") {
      const clipId = String(payload.clipId ?? "");
      const clip = await q1<Row>(`SELECT * FROM clips WHERE id = ?`, [clipId]);
      if (!clip) throw new Error("Clip not found");
      const project = await q1<Row>(`SELECT * FROM projects WHERE id = ?`, [clip.project_id]);
      await jobLog("Regenerating titles, description and hashtags");
      const seo = await generateSeo({
        moment: momentFromClip(clip),
        sourceTitle: project?.title ?? "Video",
        channel: project?.channel,
        platform: project?.platform ?? "upload",
        useLlm: llmEnabled,
      });
      await run(`UPDATE clips SET seo_json = ?, title = ?, updated_at = ? WHERE id = ?`, [
        JSON.stringify(seo),
        seo.recommendedTitle,
        nowIso(),
        clipId,
      ]);
      await updateJob(jobId, { status: "done", progress: 100 });
    } else {
      throw new Error(`Unknown job type: ${job.type}`);
    }
    log(`✔ ${job.type} ${jobId}`);
  } catch (error: unknown) {
    const attempts = Number(job.attempts ?? 1);
    const message = errorMessage(error).slice(0, 900);
    await recordJobLog(jobId, `Error: ${message}`, "error");
    log(`✖ ${job.type} ${jobId}: ${message}`);
    if (attempts < 2) {
      await updateJob(jobId, { status: "queued", stage: `Retrying (attempt ${attempts + 1})` });
    } else {
      await updateJob(jobId, { status: "failed", error: message });
      if (job.type === "process_project" && job.project_id) {
        await run(
          `UPDATE projects SET status='failed', error=?, updated_at=? WHERE id=? AND status != 'ready'`,
          [message, nowIso(), job.project_id],
        );
      }
      if (job.type === "render_clip") {
        const clipId = JSON.parse(job.payload_json ?? "{}").clipId;
        if (clipId)
          await run(`UPDATE clips SET status='failed', error=?, updated_at=? WHERE id=?`, [
            message,
            nowIso(),
            clipId,
          ]);
      }
    }
  } finally {
    clearInterval(heartbeat);
  }
}

async function loop() {
  log(`worker ${WORKER_ID} online · concurrency=${env.workerConcurrency} · stt=${env.sttProvider} · llm=${llmEnabled ? "on" : "off"}`);
  let lastSweep = 0;
  while (running) {
    if (Date.now() - lastSweep > 60_000) {
      lastSweep = Date.now();
      const requeued = await requeueStaleJobs().catch(() => 0);
      if (requeued) log(`requeued ${requeued} stale job(s)`);
    }
    if (activeJobs >= env.workerConcurrency) {
      await new Promise((r) => setTimeout(r, 300));
      continue;
    }
    let job: Row | null = null;
    try {
      job = await claimNext(WORKER_ID);
    } catch (err: unknown) {
      log(`claim error: ${errorMessage(err)}`);
      await new Promise((r) => setTimeout(r, 2000));
      continue;
    }
    if (!job) {
      await new Promise((r) => setTimeout(r, env.workerPollMs));
      continue;
    }
    activeJobs++;
    void runJob(job).finally(() => {
      activeJobs--;
    });
  }
  log("worker shutting down");
}

process.on("SIGINT", () => {
  running = false;
  log("SIGINT received — finishing in-flight jobs");
  setTimeout(() => process.exit(0), 5000);
});
process.on("SIGTERM", () => {
  running = false;
  setTimeout(() => process.exit(0), 5000);
});

void loop();
