import { z } from "zod";
import { badRequest, json, readJson, requireUser, route } from "@/lib/api";
import { nowIso, q1, run, type Row } from "@/lib/db";
import { getUsage, usageSeries } from "@/lib/entitlements";
import { PLANS, PLAN_ORDER } from "@/lib/plans";
import { getSessionUser, publicUser } from "@/lib/auth";

export const GET = route("billing.get", async () => {
  const user = await requireUser();
  const usage = await getUsage(user.id, user.plan, user.role === "admin");
  const series = await usageSeries(user.id, 14);
  const projectCount = await q1<Row>(
    `SELECT COUNT(*) AS n FROM projects WHERE user_id = ?`,
    [user.id],
  );
  const clipCount = await q1<Row>(
    `SELECT COUNT(*) AS n FROM clips WHERE user_id = ? AND status = 'ready'`,
    [user.id],
  );
  return json({
    user: publicUser(user),
    usage,
    series,
    plans: PLAN_ORDER.map((id) => PLANS[id]),
    counts: { projects: Number(projectCount?.n ?? 0), clips: Number(clipCount?.n ?? 0) },
  });
});

const schema = z.object({ plan: z.enum(["free", "pro", "ultimate"]) });

/**
 * Plan changes. In production this endpoint is called by the billing provider's
 * webhook (Stripe / Paddle / Lemon Squeezy) after payment succeeds — see README.
 * Self-serve upgrades are enabled outside production so the flow is testable.
 */
export const POST = route("billing.change", async (req) => {
  const user = await requireUser();
  if (user.role === "admin") {
    throw badRequest("Admin accounts have unlimited access and cannot change plans.");
  }
  const parsed = schema.safeParse(await readJson(req));
  if (!parsed.success) throw badRequest("Unknown plan.");
  const plan = PLANS[parsed.data.plan];

  const isProd = process.env.NODE_ENV === "production";
  const hasBillingKey = Boolean(process.env.STRIPE_SECRET_KEY);
  if (isProd && hasBillingKey) {
    return json(
      {
        error: "Complete checkout to change plans.",
        code: "checkout_required",
        checkoutUrl: `/api/billing/checkout?plan=${plan.id}`,
      },
      402,
    );
  }

  await run(
    `UPDATE users SET plan = ?, plan_status = 'active', plan_renews_at = ?, updated_at = ? WHERE id = ?`,
    [
      plan.id,
      plan.priceMonthly > 0
        ? new Date(Date.now() + 30 * 24 * 3600 * 1000).toISOString()
        : null,
      nowIso(),
      user.id,
    ],
  );
  const fresh = await getSessionUser();
  const usage = await getUsage(user.id, plan.id);
  return json({ ok: true, user: fresh ? publicUser(fresh) : null, usage });
});
