import type { ReactNode } from "react";

export function AuthCard({
  title,
  subtitle,
  children,
  footer,
}: {
  title: string;
  subtitle?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
}) {
  return (
    <div className="glass relative overflow-hidden rounded-3xl p-7 shadow-[0_40px_100px_-50px_rgba(109,94,248,0.9)]">
      <div className="pointer-events-none absolute inset-x-12 -top-28 h-40 bg-violet-500/25 blur-3xl" />
      <div className="relative">
        <h1 className="font-display text-2xl font-bold tracking-tight text-white">{title}</h1>
        {subtitle ? <p className="mt-1.5 text-[13px] leading-relaxed text-white/50">{subtitle}</p> : null}
        <div className="mt-6">{children}</div>
        {footer ? <div className="mt-6 text-center text-[12.5px] text-white/45">{footer}</div> : null}
      </div>
    </div>
  );
}

export function GoogleButton({ label = "Continue with Google" }: { label?: string }) {
  return (
    <a
      href="/api/auth/google/start"
      className="flex h-11 w-full items-center justify-center gap-2.5 rounded-xl border border-white/12 bg-white/6 text-[13.5px] font-medium text-white transition hover:bg-white/12"
    >
      <svg viewBox="0 0 24 24" className="size-4.5" aria-hidden>
        <path
          fill="#4285F4"
          d="M23.5 12.3c0-.9-.1-1.5-.2-2.2H12v4.1h6.5c-.1 1.1-.8 2.7-2.4 3.8l3.7 2.9c2.2-2 3.7-5 3.7-8.6"
        />
        <path
          fill="#34A853"
          d="M12 24c3.1 0 5.7-1 7.6-2.8l-3.7-2.9c-1 .7-2.3 1.2-3.9 1.2-3 0-5.6-2-6.5-4.8l-3.8 3C3.6 21.3 7.5 24 12 24"
        />
        <path
          fill="#FBBC05"
          d="M5.5 14.7a7.2 7.2 0 0 1 0-4.6l-3.8-3A12 12 0 0 0 0 12c0 1.9.5 3.8 1.7 5.7z"
        />
        <path
          fill="#EA4335"
          d="M12 4.7c2.1 0 3.6.9 4.4 1.7l3.2-3.1C17.7 1.5 15.1 0 12 0 7.5 0 3.6 2.7 1.7 6.3l3.8 3C6.4 6.6 9 4.7 12 4.7"
        />
      </svg>
      {label}
    </a>
  );
}

export function AuthDivider() {
  return (
    <div className="my-5 flex items-center gap-3">
      <span className="h-px flex-1 bg-white/10" />
      <span className="text-[11px] uppercase tracking-wider text-white/30">or</span>
      <span className="h-px flex-1 bg-white/10" />
    </div>
  );
}

export function FormError({ message }: { message: string | null }) {
  if (!message) return null;
  return (
    <div className="mb-4 rounded-xl border border-rose-400/25 bg-rose-500/10 px-3.5 py-2.5 text-[12.5px] leading-relaxed text-rose-200">
      {message}
    </div>
  );
}
