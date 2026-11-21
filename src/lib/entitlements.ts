/** Usage metering + plan enforcement. Every limit is checked on the server. */
import { nowIso, q1, q, run, type Row } from "./db";
import { getEffectivePlan, type PlanId, type PlanLimits } from "./plans";
import { HttpError } from "./api";
import crypto from "node:crypto";

export function monthStart(d = new Date()): string {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1)).toISOString();
}

export interface UsageSummary {
  plan: PlanLimits;
  isUnlimited: boolean;
  usedSeconds: number;
  includedSeconds: number;
  remainingSeconds: number;
  usedMinutes: number;
  includedMinutes: number;
  remainingMinutes: number;
  clipsThisMonth: number;
  percent: number;
  periodStart: string;
}

export async function getUsage(userId: string, planId: string, isAdmin = false): Promise<UsageSummary> {
  const plan = getEffectivePlan(planId, isAdmin);
  const start = monthStart();
  const row = await q1<Row>(
    `SELECT COALESCE(SUM(CASE WHEN kind = 'processed_seconds' THEN seconds ELSE 0 END), 0) AS used,
            COALESCE(SUM(CASE WHEN kind = 'clip_created' THEN 1 ELSE 0 END), 0) AS clips
       FROM usage_events WHERE user_id = ? AND created_at >= ?`,
    [userId, start],
  );
  const usedSeconds = Number(row?.used ?? 0);
  const included = plan.minutesPerMonth * 60;
  return {
    plan,
    isUnlimited: isAdmin,
    usedSeconds,
    includedSeconds: included,
    includedMinutes: plan.minutesPerMonth,
    usedMinutes: Math.round((usedSeconds / 60) * 10) / 10,
    remainingSeconds: Math.max(0, included - usedSeconds),
    remainingMinutes: Math.max(0, Math.round(((included - usedSeconds) / 60) * 10) / 10),
    clipsThisMonth: Number(row?.clips ?? 0),
    percent: isAdmin || included <= 0 ? 0 : Math.min(100, Math.round((usedSeconds / included) * 100)),
    periodStart: start,
  };
}

/** Throws a 402-style error when a project would exceed the monthly allowance. */
export async function assertCanProcess(
  userId: string,
  planId: string,
  sourceSeconds: number,
  isAdmin = false,
) {
  const usage = await getUsage(userId, planId, isAdmin);
  if (usage.isUnlimited) return usage;
  const plan = usage.plan;
  if (sourceSeconds > plan.maxSourceMinutes * 60) {
    throw new HttpError(
      402,
      `${plan.name} supports sources up to ${plan.maxSourceMinutes} minutes. This video is ${Math.round(
        sourceSeconds / 60,
      )} minutes — upgrade your plan to process it.`,
    );
  }
  if (usage.remainingSeconds < sourceSeconds) {
    throw new HttpError(
      402,
      `Not enough processing minutes left. You have ${usage.remainingMinutes} min of ${usage.includedMinutes} min left this month.`,
    );
  }
  return usage;
}

export function clipsAllowed(plan: PlanLimits, requested: number, isAdmin = false) {
  return isAdmin ? Math.max(1, requested) : Math.max(1, Math.min(requested, plan.clipsPerProject));
}

export async function recordUsage(input: {
  userId: string;
  kind: "processed_seconds" | "clip_created" | "export";
  seconds?: number;
  projectId?: string;
  clipId?: string;
  meta?: unknown;
}) {
  await run(
    `INSERT INTO usage_events (id, user_id, kind, seconds, project_id, clip_id, meta_json, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      crypto.randomUUID(),
      input.userId,
      input.kind,
      input.seconds ?? 0,
      input.projectId ?? null,
      input.clipId ?? null,
      input.meta ? JSON.stringify(input.meta) : null,
      nowIso(),
    ],
  );
}

/** Weekly activity series for the dashboard chart. */
export async function usageSeries(userId: string, days = 14) {
  const since = new Date(Date.now() - days * 86400_000).toISOString();
  const rows = await q<Row>(
    `SELECT substr(created_at, 1, 10) AS day,
            COALESCE(SUM(CASE WHEN kind = 'processed_seconds' THEN seconds ELSE 0 END), 0) AS seconds,
            COALESCE(SUM(CASE WHEN kind = 'clip_created' THEN 1 ELSE 0 END), 0) AS clips
       FROM usage_events WHERE user_id = ? AND created_at >= ?
      GROUP BY substr(created_at, 1, 10) ORDER BY day ASC`,
    [userId, since],
  );
  const map = new Map(rows.map((r) => [String(r.day), r]));
  return Array.from({ length: days }, (_, i) => {
    const d = new Date(Date.now() - (days - 1 - i) * 86400_000);
    const key = d.toISOString().slice(0, 10);
    const row = map.get(key);
    return {
      day: key,
      minutes: Math.round((Number(row?.seconds ?? 0) / 60) * 10) / 10,
      clips: Number(row?.clips ?? 0),
    };
  });
}

export function planUpgradeHint(plan: PlanId) {
  return plan === "free" ? "pro" : plan === "pro" ? "ultimate" : null;
}
