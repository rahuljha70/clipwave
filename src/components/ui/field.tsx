"use client";

import { forwardRef, type InputHTMLAttributes, type ReactNode, type TextareaHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

export function Label({
  children,
  hint,
  htmlFor,
  className,
}: {
  children: ReactNode;
  hint?: ReactNode;
  htmlFor?: string;
  className?: string;
}) {
  return (
    <div className={cn("mb-1.5 flex items-baseline justify-between gap-3", className)}>
      <label htmlFor={htmlFor} className="text-[12.5px] font-medium text-white/70">
        {children}
      </label>
      {hint ? <span className="text-[11px] text-white/40">{hint}</span> : null}
    </div>
  );
}

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(
  function Input({ className, ...props }, ref) {
    return (
      <input
        ref={ref}
        className={cn(
          "h-11 w-full rounded-xl border border-white/10 bg-ink-900/70 px-3.5 text-sm text-white placeholder:text-white/30",
          "transition focus:border-violet-400/60 focus:bg-ink-900 focus:outline-none focus:ring-2 focus:ring-violet-500/25",
          "disabled:opacity-60",
          className,
        )}
        {...props}
      />
    );
  },
);

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement>>(
  function Textarea({ className, ...props }, ref) {
    return (
      <textarea
        ref={ref}
        className={cn(
          "w-full rounded-xl border border-white/10 bg-ink-900/70 px-3.5 py-3 text-sm leading-relaxed text-white placeholder:text-white/30",
          "transition focus:border-violet-400/60 focus:bg-ink-900 focus:outline-none focus:ring-2 focus:ring-violet-500/25",
          className,
        )}
        {...props}
      />
    );
  },
);

export function Select({
  value,
  onChange,
  options,
  className,
  disabled,
}: {
  value: string;
  onChange: (value: string) => void;
  options: { value: string; label: string }[];
  className?: string;
  disabled?: boolean;
}) {
  return (
    <div className={cn("relative", className)}>
      <select
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
        className={cn(
          "h-11 w-full appearance-none rounded-xl border border-white/10 bg-ink-900/70 px-3.5 pr-9 text-sm text-white",
          "transition focus:border-violet-400/60 focus:outline-none focus:ring-2 focus:ring-violet-500/25",
          "disabled:opacity-60",
        )}
      >
        {options.map((opt) => (
          <option key={opt.value} value={opt.value} className="bg-ink-900 text-white">
            {opt.label}
          </option>
        ))}
      </select>
      <svg
        className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-white/40"
        viewBox="0 0 20 20"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
      >
        <path d="M6 8l4 4 4-4" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </div>
  );
}

export function Switch({
  checked,
  onChange,
  label,
  description,
  disabled,
}: {
  checked: boolean;
  onChange: (next: boolean) => void;
  label?: ReactNode;
  description?: ReactNode;
  disabled?: boolean;
}) {
  return (
    <label className={cn("flex cursor-pointer items-center justify-between gap-4", disabled && "opacity-60")}>
      {label ? (
        <span>
          <span className="block text-sm font-medium text-white/85">{label}</span>
          {description ? <span className="mt-0.5 block text-xs text-white/45">{description}</span> : null}
        </span>
      ) : null}
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={cn(
          "relative h-6 w-11 shrink-0 rounded-full border transition-colors duration-300",
          checked
            ? "border-violet-400/60 bg-gradient-to-r from-violet-500 to-electric-500"
            : "border-white/15 bg-white/10",
        )}
      >
        <span
          className={cn(
            "absolute top-0.5 size-4.5 rounded-full bg-white shadow transition-all duration-300",
            checked ? "left-[22px]" : "left-0.5",
          )}
          style={{ height: 18, width: 18 }}
        />
      </button>
    </label>
  );
}

export function Slider({
  value,
  min,
  max,
  step = 1,
  onChange,
  label,
  format,
}: {
  value: number;
  min: number;
  max: number;
  step?: number;
  onChange: (value: number) => void;
  label?: ReactNode;
  format?: (value: number) => string;
}) {
  return (
    <div>
      {label ? (
        <div className="mb-2 flex items-center justify-between text-[12.5px] text-white/70">
          <span>{label}</span>
          <span className="font-mono text-xs text-white/50">{format ? format(value) : value}</span>
        </div>
      ) : null}
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="h-1.5 w-full cursor-pointer appearance-none rounded-full bg-white/12 accent-violet-500
          [&::-webkit-slider-thumb]:size-4 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full
          [&::-webkit-slider-thumb]:bg-white [&::-webkit-slider-thumb]:shadow-[0_0_0_4px_rgba(109,94,248,0.35)]
          [&::-moz-range-thumb]:size-4 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:border-0 [&::-moz-range-thumb]:bg-white"
      />
    </div>
  );
}
