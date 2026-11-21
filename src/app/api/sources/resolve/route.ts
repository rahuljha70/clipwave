import { z } from "zod";
import { badRequest, json, readJson, requireUser, route } from "@/lib/api";
import { detectPlatform, resolveSource, SourceError } from "@/lib/sources";
import { getEffectivePlan } from "@/lib/plans";
import { getUsage } from "@/lib/entitlements";

const schema = z.object({ url: z.string().min(3).max(600) });

/** Validates a link and returns metadata without creating a project. */
export const POST = route("sources.resolve", async (req) => {
  const user = await requireUser();
  const isAdmin = user.role === "admin";
  const parsed = schema.safeParse(await readJson(req));
  if (!parsed.success) throw badRequest("Paste a valid video URL.");

  const detected = detectPlatform(parsed.data.url);
  try {
    const meta = await resolveSource(parsed.data.url);
    const plan = getEffectivePlan(user.plan, isAdmin);
    const usage = await getUsage(user.id, user.plan, isAdmin);
    const withinSourceLimit = usage.isUnlimited || meta.durationSec <= plan.maxSourceMinutes * 60;
    const withinMonthlyLimit = usage.isUnlimited || meta.durationSec <= usage.remainingSeconds;
    return json({
      source: {
        ...meta,
        minutes: Math.round((meta.durationSec / 60) * 10) / 10,
      },
      platform: detected.platform,
      entitlement: {
        allowed: withinSourceLimit && withinMonthlyLimit,
        isUnlimited: usage.isUnlimited,
        maxSourceMinutes: usage.isUnlimited ? null : plan.maxSourceMinutes,
        remainingMinutes: usage.isUnlimited ? null : usage.remainingMinutes,
        reason:
          !withinSourceLimit
            ? `Your ${plan.name} plan supports sources up to ${plan.maxSourceMinutes} minutes.`
            : !withinMonthlyLimit
              ? `Only ${usage.remainingMinutes} processing minutes left this month.`
              : null,
      },
    });
  } catch (error) {
    if (error instanceof SourceError) {
      return json({ error: error.message, code: error.code }, 422);
    }
    throw error;
  }
});
