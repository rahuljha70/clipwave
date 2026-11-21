"use client";

import { motion } from "framer-motion";
import { Check, Sparkles, Zap } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { PLANS, PLAN_ORDER, type PlanId } from "@/lib/plans";
import { cn } from "@/lib/utils";

export function PricingTable({
  currentPlan,
  onSelect,
  busyPlan,
  compact,
}: {
  currentPlan?: PlanId | string;
  onSelect?: (plan: PlanId) => void;
  busyPlan?: PlanId | null;
  compact?: boolean;
}) {
  return (
    <div className={cn("grid gap-5", compact ? "lg:grid-cols-3" : "lg:grid-cols-3")}>
      {PLAN_ORDER.map((id, index) => {
        const plan = PLANS[id];
        const isCurrent = currentPlan === id;
        const featured = id === "pro";
        return (
          <motion.div
            key={id}
            initial={{ opacity: 0, y: 26 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-60px" }}
            transition={{ duration: 0.55, delay: index * 0.08 }}
            className={cn(
              "relative flex flex-col overflow-hidden rounded-3xl p-6 card-hover",
              featured
                ? "border border-violet-400/40 bg-gradient-to-b from-violet-500/[0.14] to-ink-900/70 shadow-[0_30px_80px_-40px_rgba(109,94,248,0.8)]"
                : "glass hover:-translate-y-1",
            )}
          >
            {featured ? (
              <span className="absolute right-5 top-5 inline-flex items-center gap-1 rounded-full bg-gradient-to-r from-violet-500 to-electric-500 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-white">
                <Sparkles className="size-3" /> Most popular
              </span>
            ) : null}

            <p className="font-display text-lg font-semibold text-white">{plan.name}</p>
            <p className="mt-1 min-h-[34px] text-[12.5px] leading-snug text-white/45">{plan.tagline}</p>

            <div className="mt-4 flex items-baseline gap-1.5">
              <span className="font-display text-4xl font-bold text-white">
                ${plan.priceMonthly}
              </span>
              <span className="text-[13px] text-white/40">/month</span>
            </div>

            <div className="mt-5 space-y-2.5">
              {plan.features.map((feature) => (
                <div key={feature} className="flex items-start gap-2.5">
                  <span
                    className={cn(
                      "mt-0.5 grid size-4 shrink-0 place-items-center rounded-full",
                      featured ? "bg-violet-400/25 text-violet-200" : "bg-white/8 text-white/60",
                    )}
                  >
                    <Check className="size-2.5" strokeWidth={3} />
                  </span>
                  <span className="text-[12.5px] leading-snug text-white/65">{feature}</span>
                </div>
              ))}
            </div>

            <div className="mt-auto pt-6">
              {onSelect ? (
                <Button
                  className="w-full"
                  variant={isCurrent ? "secondary" : featured ? "primary" : "secondary"}
                  disabled={isCurrent}
                  loading={busyPlan === id}
                  onClick={() => onSelect(id)}
                  icon={featured && !isCurrent ? <Zap className="size-4" /> : undefined}
                >
                  {isCurrent ? "Current plan" : plan.priceMonthly === 0 ? "Downgrade" : `Switch to ${plan.name}`}
                </Button>
              ) : (
                <Link
                  href={plan.priceMonthly === 0 ? "/register" : `/register?plan=${id}`}
                  className={cn(
                    "flex h-11 w-full items-center justify-center rounded-xl text-sm font-medium transition",
                    featured
                      ? "bg-gradient-to-r from-violet-500 to-electric-500 text-white hover:brightness-110"
                      : "border border-white/12 bg-white/6 text-white hover:bg-white/12",
                  )}
                >
                  {plan.priceMonthly === 0 ? "Start free" : `Choose ${plan.name}`}
                </Link>
              )}
            </div>
          </motion.div>
        );
      })}
    </div>
  );
}
