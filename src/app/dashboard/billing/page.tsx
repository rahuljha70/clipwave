"use client";

import { CreditCard, HardDrive, Sparkles, TrendingUp, Zap } from "lucide-react";
import { useState } from "react";
import { PricingTable } from "@/components/pricing-table";
import { GlassCard, StatCard } from "@/components/ui/card";
import { Badge, PlanBadge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/progress";
import { MiniBars } from "@/components/dashboard/charts";
import { useToast } from "@/components/ui/toast";
import { apiPost, useApi } from "@/lib/client/api";
import { errorMessage, relativeTime } from "@/lib/utils";
import type { PlanId } from "@/lib/plans";
import type { BillingResponse } from "@/lib/contracts";

export default function BillingPage() {
  const toast = useToast();
  const { data, loading, refresh } = useApi<BillingResponse>("/api/billing");
  const [busyPlan, setBusyPlan] = useState<PlanId | null>(null);

  const usage = data?.usage;

  const changePlan = async (plan: PlanId) => {
    setBusyPlan(plan);
    try {
      await apiPost("/api/billing/change", { plan });
      toast.success("Plan updated", `You're now on ${plan}.`);
      await refresh();
    } catch (err: unknown) {
      toast.error(errorMessage(err, "Could not change the plan"));
    } finally {
      setBusyPlan(null);
    }
  };

  if (loading && !data) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-36 w-full rounded-3xl" />
        <Skeleton className="h-64 w-full rounded-3xl" />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div>
        <h1 className="font-display text-2xl font-bold tracking-tight text-white">Billing & usage</h1>
        <p className="mt-1 text-[13px] text-white/50">
          {usage?.isUnlimited
            ? "Your administrator account has unlimited access to every plan feature."
            : "Processing minutes reset on the 1st of each month. Editing and re-rendering a clip never costs extra minutes."}
        </p>
      </div>

      <div className="grid gap-4 lg:grid-cols-[1.3fr_1fr]">
        <GlassCard className="p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <div className="flex items-center gap-2">
                <PlanBadge plan={data?.user?.plan ?? "free"} />
                <Badge tone="neutral">
                  <CreditCard className="size-3" /> {data?.user?.planStatus ?? "active"}
                </Badge>
              </div>
              <p className="mt-3 font-display text-3xl font-bold text-white">
                {usage?.isUnlimited ? "Unlimited" : usage?.includedMinutes ?? 0}
                {!usage?.isUnlimited ? (
                  <span className="text-sm font-normal text-white/40"> min / month</span>
                ) : null}
              </p>
              <p className="mt-1 text-[12px] text-white/45">
                {usage?.isUnlimited
                  ? "No monthly minute or source-length limits"
                  : `${usage?.remainingMinutes ?? 0} min remaining · renews ${data?.user?.planRenewsAt ? relativeTime(data.user.planRenewsAt) : "monthly"}`}
              </p>
            </div>
            <div className="w-full max-w-[220px]">
              <p className="mb-1.5 text-[11px] uppercase tracking-wider text-white/35">Usage</p>
              {usage?.isUnlimited ? (
                <p className="text-[13px] font-medium text-emerald-200">Unlimited access</p>
              ) : (
                <>
                  <Progress value={usage?.percent ?? 0} showValue />
                  <p className="mt-1.5 text-[11px] text-white/35">
                    {usage?.usedMinutes ?? 0} of {usage?.includedMinutes ?? 0} minutes used
                  </p>
                </>
              )}
            </div>
          </div>

          <div className="mt-5">
            <p className="mb-2 inline-flex items-center gap-1.5 text-[11.5px] text-white/40">
              <TrendingUp className="size-3.5" /> Processing minutes — last 14 days
            </p>
            <MiniBars data={data?.series ?? []} height={80} />
          </div>
        </GlassCard>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-1">
          <StatCard
            label="Projects"
            value={data?.counts?.projects ?? 0}
            hint="Total imports"
            icon={<Zap className="size-4.5" />}
          />
          <StatCard
            label="Clips generated"
            value={data?.counts?.clips ?? 0}
            hint={`${usage?.clipsThisMonth ?? 0} this month`}
            icon={<Sparkles className="size-4.5" />}
            accent="electric"
          />
        </div>
      </div>

      {data?.user?.role === "admin" ? (
        <GlassCard className="p-5">
          <h2 className="text-[13.5px] font-semibold text-white">Administrator access</h2>
          <p className="mt-2 text-[12px] leading-relaxed text-white/45">
            This account has every current plan feature, no monthly processing cap, no source-length cap,
            and no per-project plan limit.
          </p>
        </GlassCard>
      ) : (
      <GlassCard className="p-5">
        <div className="flex items-center gap-2">
          <HardDrive className="size-4 text-amber-400" />
          <h2 className="text-[13.5px] font-semibold text-white">Plans</h2>
          <span className="text-[11.5px] text-white/35">
            Upgrades apply instantly in this deployment
          </span>
        </div>
        <div className="mt-4">
          <PricingTable
            currentPlan={data?.user?.plan}
            onSelect={changePlan}
            busyPlan={busyPlan}
            compact
          />
        </div>
        <p className="mt-4 rounded-xl border border-white/8 bg-white/[0.02] p-3 text-[11px] leading-relaxed text-white/35">
          In production, plan changes are applied by the billing provider webhook
          (<code className="text-violet-300">STRIPE_SECRET_KEY</code> +{" "}
          <code className="text-violet-300">/api/billing/change</code>). Set those env vars and this
          page will redirect to checkout instead of switching directly.
        </p>
      </GlassCard>
      )}
    </div>
  );
}
