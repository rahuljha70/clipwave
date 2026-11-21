import { cn } from "@/lib/utils";

export function Logo({ className, size = 34 }: { className?: string; size?: number }) {
  return (
    <span className={cn("inline-flex items-center gap-2.5", className)}>
      <span
        className="relative inline-flex items-center justify-center overflow-hidden rounded-[11px] border border-white/12 bg-ink-900"
        style={{ width: size, height: size }}
      >
        <span className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,rgba(109,94,248,0.55),transparent_65%),radial-gradient(circle_at_75%_80%,rgba(56,232,255,0.4),transparent_60%)]" />
        <svg viewBox="0 0 32 32" width={size * 0.62} height={size * 0.62} className="relative">
          <defs>
            <linearGradient id="cw-mark" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0" stopColor="#B7ADFF" />
              <stop offset="1" stopColor="#38E8FF" />
            </linearGradient>
          </defs>
          <path
            d="M8 6h6.4v7.6L21 6h6.6l-8.4 10.2L28 26h-6.8l-6.8-7.6V26H8z"
            fill="url(#cw-mark)"
          />
        </svg>
      </span>
      <span className="font-display text-[17px] font-semibold tracking-tight text-white">
        Clipwave
      </span>
    </span>
  );
}

export function LogoMark({ size = 32 }: { size?: number }) {
  return <Logo size={size} className="[&>span:last-child]:hidden" />;
}
