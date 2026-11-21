"use client";

import { Loader2 } from "lucide-react";
import Link from "next/link";
import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from "react";
import { cn } from "@/lib/utils";

type Variant = "primary" | "secondary" | "ghost" | "outline" | "danger" | "success";
type Size = "sm" | "md" | "lg" | "icon";

const VARIANTS: Record<Variant, string> = {
  primary:
    "bg-gradient-to-r from-violet-500 via-violet-400 to-electric-500 text-white shadow-[0_10px_34px_-12px_rgba(109,94,248,0.85)] hover:brightness-110",
  secondary:
    "bg-white/8 text-white border border-white/12 hover:bg-white/14 hover:border-white/20",
  ghost: "text-white/70 hover:text-white hover:bg-white/8",
  outline:
    "border border-violet-400/40 text-violet-200 hover:bg-violet-500/12 hover:border-violet-400/70",
  danger: "bg-rose-500/90 text-white hover:bg-rose-500",
  success: "bg-mint-400 text-ink-950 hover:brightness-105 font-semibold",
};

const SIZES: Record<Size, string> = {
  sm: "h-9 px-3.5 text-[13px] gap-1.5 rounded-xl",
  md: "h-11 px-5 text-sm gap-2 rounded-xl",
  lg: "h-13 px-7 text-[15px] gap-2.5 rounded-2xl",
  icon: "size-10 rounded-xl",
};

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
  icon?: ReactNode;
  iconRight?: ReactNode;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { className, variant = "primary", size = "md", loading, icon, iconRight, children, disabled, ...props },
  ref,
) {
  return (
    <button
      ref={ref}
      disabled={disabled || loading}
      className={cn(
        "relative inline-flex select-none items-center justify-center whitespace-nowrap font-medium transition-all duration-200",
        "focus-visible:ring-focus active:scale-[0.985]",
        "disabled:cursor-not-allowed disabled:opacity-50 disabled:active:scale-100",
        VARIANTS[variant],
        SIZES[size],
        className,
      )}
      {...props}
    >
      {loading ? <Loader2 className="size-4 animate-spin" /> : icon}
      {children}
      {iconRight}
    </button>
  );
});

export function LinkButton({
  href,
  children,
  className,
  variant = "primary",
  size = "md",
  icon,
  iconRight,
}: {
  href: string;
  children: ReactNode;
  className?: string;
  variant?: Variant;
  size?: Size;
  icon?: ReactNode;
  iconRight?: ReactNode;
}) {
  return (
    <Link
      href={href}
      className={cn(
        "relative inline-flex select-none items-center justify-center whitespace-nowrap font-medium transition-all duration-200 active:scale-[0.985]",
        VARIANTS[variant],
        SIZES[size],
        className,
      )}
    >
      {icon}
      {children}
      {iconRight}
    </Link>
  );
}

export function IconButton({
  className,
  label,
  children,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { label: string }) {
  return (
    <button
      aria-label={label}
      title={label}
      className={cn(
        "inline-flex size-9 items-center justify-center rounded-lg text-white/60 transition hover:bg-white/10 hover:text-white",
        className,
      )}
      {...props}
    >
      {children}
    </button>
  );
}
