import { cn } from "@/lib/utils";
import type { ReactNode } from "react";

export function GlassCard({
  children,
  className,
  hover,
  glow,
}: {
  children: ReactNode;
  className?: string;
  hover?: boolean;
  glow?: boolean;
}) {
  return (
    <div
      className={cn(
        "glass card-hover rounded-3xl",
        hover && "hover:-translate-y-0.5 hover:border-violet-400/30 hover:shadow-[0_24px_60px_-30px_rgba(109,94,248,0.55)]",
        glow && "glow-violet",
        className,
      )}
    >
      {children}
    </div>
  );
}

export function StatCard({
  label,
  value,
  hint,
  icon,
  accent = "violet",
}: {
  label: string;
  value: ReactNode;
  hint?: ReactNode;
  icon?: ReactNode;
  accent?: "violet" | "electric" | "mint" | "amber";
}) {
  const accents: Record<string, string> = {
    violet: "from-violet-500/25 to-violet-500/0 text-violet-300",
    electric: "from-electric-500/25 to-electric-500/0 text-electric-400",
    mint: "from-mint-400/25 to-mint-400/0 text-mint-400",
    amber: "from-amber-400/25 to-amber-400/0 text-amber-400",
  };
  return (
    <div className="glass group relative overflow-hidden rounded-3xl p-5 card-hover hover:-translate-y-0.5 hover:border-white/20">
      <div
        className={cn(
          "pointer-events-none absolute -right-8 -top-10 size-36 rounded-full bg-gradient-to-br blur-2xl transition-opacity duration-500 group-hover:opacity-90",
          accents[accent],
        )}
      />
      <div className="relative flex items-start justify-between">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-white/45">{label}</p>
          <p className="mt-2 font-display text-[26px] font-semibold leading-none text-white">{value}</p>
        </div>
        {icon ? (
          <span className={cn("rounded-xl bg-white/6 p-2.5", accents[accent].split(" ").pop())}>{icon}</span>
        ) : null}
      </div>
      {hint ? <div className="relative mt-3 text-xs text-white/50">{hint}</div> : null}
    </div>
  );
}

export function SectionHeading({
  eyebrow,
  title,
  description,
  center,
  action,
}: {
  eyebrow?: string;
  title: ReactNode;
  description?: ReactNode;
  center?: boolean;
  action?: ReactNode;
}) {
  return (
    <div
      className={cn(
        "flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between",
        center && "sm:flex-col sm:items-center sm:text-center",
      )}
    >
      <div className={cn(center && "max-w-2xl")}>
        {eyebrow ? (
          <span className="inline-flex items-center gap-2 rounded-full border border-violet-400/25 bg-violet-500/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-violet-200">
            {eyebrow}
          </span>
        ) : null}
        <h2 className="mt-3 font-display text-2xl font-semibold tracking-tight text-white sm:text-[28px]">
          {title}
        </h2>
        {description ? <p className="mt-2 text-sm leading-relaxed text-white/55">{description}</p> : null}
      </div>
      {action}
    </div>
  );
}
