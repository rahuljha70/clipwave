"use client";

import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

export function Progress({
  value,
  className,
  showValue,
  tone = "violet",
}: {
  value: number;
  className?: string;
  showValue?: boolean;
  tone?: "violet" | "mint" | "electric";
}) {
  const clamped = Math.max(0, Math.min(100, value));
  const gradients: Record<string, string> = {
    violet: "from-violet-500 via-violet-400 to-electric-500",
    mint: "from-mint-400 to-electric-400",
    electric: "from-electric-500 to-cyan-400",
  };
  return (
    <div className={cn("flex items-center gap-3", className)}>
      <div className="relative h-1.5 flex-1 overflow-hidden rounded-full bg-white/10">
        <motion.div
          className={cn("absolute inset-y-0 left-0 rounded-full bg-gradient-to-r", gradients[tone])}
          initial={{ width: 0 }}
          animate={{ width: `${clamped}%` }}
          transition={{ type: "spring", stiffness: 110, damping: 20 }}
        />
        {clamped > 4 && clamped < 100 ? (
          <motion.div
            className="absolute inset-y-0 w-16 bg-white/25 blur-md"
            animate={{ left: ["-10%", "100%"] }}
            transition={{ duration: 1.8, repeat: Infinity, ease: "linear" }}
          />
        ) : null}
      </div>
      {showValue ? (
        <span className="w-9 shrink-0 text-right font-mono text-[11px] text-white/50">{Math.round(clamped)}%</span>
      ) : null}
    </div>
  );
}

export function RingProgress({
  value,
  size = 54,
  stroke = 5,
  color = "#8B7BFF",
  label,
}: {
  value: number;
  size?: number;
  stroke?: number;
  color?: string;
  label?: React.ReactNode;
}) {
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (Math.max(0, Math.min(100, value)) / 100) * circumference;
  return (
    <div className="relative inline-flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={radius} stroke="rgba(255,255,255,0.1)" strokeWidth={stroke} fill="none" />
        <motion.circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={color}
          strokeWidth={stroke}
          fill="none"
          strokeLinecap="round"
          strokeDasharray={circumference}
          initial={{ strokeDashoffset: circumference }}
          animate={{ strokeDashoffset: offset }}
          transition={{ type: "spring", stiffness: 90, damping: 18 }}
        />
      </svg>
      <span className="absolute inset-0 flex items-center justify-center text-[13px] font-semibold text-white">
        {label ?? Math.round(value)}
      </span>
    </div>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-xl bg-white/[0.055]",
        "after:absolute after:inset-0 after:animate-shimmer after:bg-[linear-gradient(90deg,transparent,rgba(255,255,255,0.08),transparent)] after:bg-[length:200%_100%]",
        className,
      )}
    />
  );
}
