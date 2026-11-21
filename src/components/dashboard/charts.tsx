"use client";

import { motion } from "framer-motion";

export function MiniBars({
  data,
  height = 72,
  metric = "minutes",
}: {
  data: { day: string; minutes: number; clips: number }[];
  height?: number;
  metric?: "minutes" | "clips";
}) {
  const values = data.map((d) => (metric === "minutes" ? d.minutes : d.clips));
  const max = Math.max(1, ...values);

  return (
    <div className="flex items-end gap-1.5" style={{ height }}>
      {data.map((point, i) => {
        const value = metric === "minutes" ? point.minutes : point.clips;
        const pct = Math.max(4, (value / max) * 100);
        return (
          <div key={point.day} className="group relative flex flex-1 flex-col justify-end">
            <motion.div
              initial={{ height: 0 }}
              animate={{ height: `${pct}%` }}
              transition={{ duration: 0.6, delay: i * 0.02, ease: [0.22, 1, 0.36, 1] }}
              className="w-full rounded-t-md bg-gradient-to-t from-violet-600/40 via-violet-500/70 to-electric-400"
              style={{ minHeight: 3 }}
            />
            <span className="pointer-events-none absolute -top-7 left-1/2 z-10 -translate-x-1/2 whitespace-nowrap rounded-md border border-white/10 bg-ink-900 px-1.5 py-0.5 text-[10px] text-white opacity-0 transition-opacity group-hover:opacity-100">
              {value} {metric === "minutes" ? "min" : "clips"}
            </span>
          </div>
        );
      })}
    </div>
  );
}

export function Sparkline({
  values,
  color = "#8B7BFF",
  height = 40,
}: {
  values: number[];
  color?: string;
  height?: number;
}) {
  if (!values.length) return null;
  const max = Math.max(1, ...values);
  const width = 160;
  const points = values.map((v, i) => {
    const x = (i / Math.max(1, values.length - 1)) * width;
    const y = height - (v / max) * (height - 6) - 3;
    return `${x},${y}`;
  });
  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="w-full" style={{ height }} preserveAspectRatio="none">
      <defs>
        <linearGradient id={`spark-${color.replace("#", "")}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.35" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <polyline points={points.join(" ")} fill="none" stroke={color} strokeWidth="1.8" strokeLinejoin="round" strokeLinecap="round" />
      <polygon
        points={`0,${height} ${points.join(" ")} ${width},${height}`}
        fill={`url(#spark-${color.replace("#", "")})`}
      />
    </svg>
  );
}
