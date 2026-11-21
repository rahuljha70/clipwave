"use client";

import { Check, Copy, type LucideIcon } from "lucide-react";
import { useState } from "react";
import { copyToClipboard } from "@/lib/client/api";
import { cn } from "@/lib/utils";

export function CopyButton({
  value,
  label = "Copy",
  className,
  onCopied,
}: {
  value: string;
  label?: string;
  className?: string;
  onCopied?: () => void;
}) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      onClick={async () => {
        await copyToClipboard(value);
        setCopied(true);
        onCopied?.();
        setTimeout(() => setCopied(false), 1600);
      }}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/5 px-2.5 py-1.5 text-[11.5px] font-medium text-white/65 transition hover:border-violet-400/40 hover:bg-violet-500/15 hover:text-white",
        className,
      )}
    >
      {copied ? <Check className="size-3.5 text-mint-400" /> : <Copy className="size-3.5" />}
      {copied ? "Copied" : label}
    </button>
  );
}

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  className,
}: {
  icon: LucideIcon;
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center rounded-3xl border border-dashed border-white/12 bg-white/[0.02] px-6 py-14 text-center",
        className,
      )}
    >
      <span className="mb-4 rounded-2xl border border-white/10 bg-white/5 p-3.5 text-violet-300">
        <Icon className="size-6" />
      </span>
      <h3 className="font-display text-base font-semibold text-white">{title}</h3>
      {description ? (
        <p className="mt-1.5 max-w-sm text-[13px] leading-relaxed text-white/45">{description}</p>
      ) : null}
      {action ? <div className="mt-5">{action}</div> : null}
    </div>
  );
}

export function Kbd({ children }: { children: React.ReactNode }) {
  return (
    <kbd className="rounded-md border border-white/15 bg-white/6 px-1.5 py-0.5 font-mono text-[10px] text-white/60">
      {children}
    </kbd>
  );
}

export function Divider({ className }: { className?: string }) {
  return <div className={cn("h-px w-full bg-gradient-to-r from-transparent via-white/10 to-transparent", className)} />;
}

export function Tooltip({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <span className="group/tt relative inline-flex">
      {children}
      <span className="pointer-events-none absolute -top-9 left-1/2 z-20 -translate-x-1/2 whitespace-nowrap rounded-lg border border-white/10 bg-ink-900 px-2 py-1 text-[11px] text-white/80 opacity-0 shadow-xl transition-opacity group-hover/tt:opacity-100">
        {label}
      </span>
    </span>
  );
}
