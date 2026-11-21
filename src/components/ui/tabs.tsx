"use client";

import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

export function Tabs<T extends string>({
  tabs,
  value,
  onChange,
  className,
  size = "md",
}: {
  tabs: { id: T; label: string; icon?: React.ReactNode }[];
  value: T;
  onChange: (id: T) => void;
  className?: string;
  size?: "sm" | "md";
}) {
  return (
    <div
      className={cn(
        "no-scrollbar inline-flex max-w-full items-center gap-1 overflow-x-auto rounded-2xl border border-white/10 bg-white/[0.04] p-1",
        className,
      )}
    >
      {tabs.map((tab) => {
        const active = tab.id === value;
        return (
          <button
            key={tab.id}
            onClick={() => onChange(tab.id)}
            className={cn(
              "relative inline-flex items-center gap-1.5 whitespace-nowrap rounded-xl font-medium transition-colors",
              size === "sm" ? "px-3 py-1.5 text-[12px]" : "px-3.5 py-2 text-[13px]",
              active ? "text-white" : "text-white/50 hover:text-white/80",
            )}
          >
            {active ? (
              <motion.span
                layoutId="tab-pill"
                className="absolute inset-0 rounded-xl border border-violet-400/25 bg-gradient-to-b from-violet-500/25 to-violet-500/5"
                transition={{ type: "spring", stiffness: 380, damping: 32 }}
              />
            ) : null}
            <span className="relative flex items-center gap-1.5">
              {tab.icon}
              {tab.label}
            </span>
          </button>
        );
      })}
    </div>
  );
}
