import { cn, scoreTone } from "@/lib/utils";
import type { ReactNode } from "react";

export function Badge({
  children,
  tone = "neutral",
  className,
}: {
  children: ReactNode;
  tone?: "neutral" | "violet" | "electric" | "mint" | "amber" | "rose";
  className?: string;
}) {
  const tones: Record<string, string> = {
    neutral: "border-white/12 bg-white/6 text-white/70",
    violet: "border-violet-400/30 bg-violet-500/15 text-violet-200",
    electric: "border-electric-500/30 bg-electric-500/15 text-electric-400",
    mint: "border-mint-400/30 bg-mint-400/15 text-mint-400",
    amber: "border-amber-400/30 bg-amber-400/15 text-amber-400",
    rose: "border-rose-400/30 bg-rose-500/15 text-rose-300",
  };
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-semibold tracking-wide",
        tones[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}

export function ScorePill({ score, size = "md" }: { score: number; size?: "sm" | "md" }) {
  const tone = scoreTone(score);
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-ink-950/70 font-semibold backdrop-blur",
        size === "sm" ? "px-2 py-0.5 text-[11px]" : "px-2.5 py-1 text-xs",
        tone.className,
      )}
    >
      <span className={cn("size-1.5 rounded-full", `bg-current`)} />
      {score}
    </span>
  );
}

export function PlanBadge({ plan }: { plan: string }) {
  const map: Record<string, { label: string; tone: "neutral" | "electric" | "violet" }> = {
    free: { label: "Free", tone: "neutral" },
    pro: { label: "Pro", tone: "electric" },
    ultimate: { label: "Ultimate", tone: "violet" },
  };
  const entry = map[plan] ?? map.free;
  return <Badge tone={entry.tone}>{entry.label}</Badge>;
}

export function PlatformBadge({ platform }: { platform: string | null | undefined }) {
  if (!platform) return null;
  const map: Record<string, { label: string; className: string }> = {
    youtube: { label: "YouTube", className: "border-rose-400/30 bg-rose-500/12 text-rose-300" },
    kick: { label: "Kick", className: "border-mint-400/30 bg-mint-400/12 text-mint-400" },
    upload: { label: "Upload", className: "border-white/12 bg-white/6 text-white/60" },
  };
  const entry = map[platform] ?? map.upload;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-md border px-2 py-0.5 text-[10.5px] font-bold uppercase tracking-[0.1em]",
        entry.className,
      )}
    >
      {entry.label}
    </span>
  );
}

export function StatusDot({ status }: { status: string }) {
  const map: Record<string, string> = {
    ready: "bg-mint-400 shadow-[0_0_0_3px_rgba(94,240,198,0.18)]",
    processing: "bg-electric-400 animate-pulse shadow-[0_0_0_3px_rgba(86,160,255,0.2)]",
    rendering: "bg-electric-400 animate-pulse shadow-[0_0_0_3px_rgba(86,160,255,0.2)]",
    queued: "bg-amber-400 shadow-[0_0_0_3px_rgba(255,216,77,0.18)]",
    failed: "bg-rose-500 shadow-[0_0_0_3px_rgba(244,63,94,0.18)]",
    canceled: "bg-white/30",
    pending: "bg-white/30",
  };
  return <span className={cn("inline-block size-2 rounded-full", map[status] ?? "bg-white/30")} />;
}
