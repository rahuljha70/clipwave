import { BookOpen, Sparkles } from "lucide-react";
import Link from "next/link";
import { Logo } from "@/components/brand";
import { LinkButton } from "@/components/ui/button";
import { UrlImport } from "./url-import";

export function CtaBand({ authed }: { authed: boolean }) {
  return (
    <section className="relative mx-auto w-full max-w-7xl px-5 pb-16 sm:px-8">
      <div className="relative overflow-hidden rounded-[2rem] border border-white/10 bg-gradient-to-br from-violet-600/25 via-ink-900 to-electric-500/20 px-6 py-12 text-center sm:px-12 sm:py-16">
        <div className="pointer-events-none absolute -left-20 -top-24 size-72 rounded-full bg-violet-500/30 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-24 -right-16 size-72 rounded-full bg-cyan-400/20 blur-3xl" />
        <div className="relative">
          <span className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-white/80">
            <Sparkles className="size-3" /> Ready in one paste
          </span>
          <h2 className="mx-auto mt-4 max-w-2xl font-display text-3xl font-bold leading-tight tracking-tight text-white sm:text-[2.6rem]">
            Your next 30 clips are already inside your last stream.
          </h2>
          <p className="mx-auto mt-3 max-w-xl text-[14px] leading-relaxed text-white/60">
            Paste the link, get scored clips with captions and metadata. Free plan includes 30 minutes
            of processing every month.
          </p>
          <div className="mx-auto mt-8 flex max-w-2xl justify-center">
            <UrlImport authed={authed} />
          </div>
        </div>
      </div>
    </section>
  );
}

export function Footer() {
  return (
    <footer className="border-t border-white/8 bg-ink-950/60">
      <div className="mx-auto grid w-full max-w-7xl gap-10 px-5 py-14 sm:px-8 md:grid-cols-[1.4fr_1fr_1fr_1fr]">
        <div>
          <Logo />
          <p className="mt-4 max-w-xs text-[12.5px] leading-relaxed text-white/40">
            AI clipping for creators who post every day. Real transcription, real rendering, honest
            scores. Built with Next.js, FFmpeg and Whisper.
          </p>
          <div className="mt-5 flex items-center gap-2">
            <LinkButton href="/register" size="sm" variant="secondary">
              Create account
            </LinkButton>
            <Link
              href="/login"
              className="rounded-xl px-3 py-2 text-[12.5px] text-white/50 transition hover:text-white"
            >
              Sign in
            </Link>
          </div>
        </div>

        <FooterColumn
          title="Product"
          links={[
            { label: "Features", href: "/#features" },
            { label: "How it works", href: "/#how-it-works" },
            { label: "Pricing", href: "/#pricing" },
            { label: "FAQ", href: "/#faq" },
          ]}
        />
        <FooterColumn
          title="Platform"
          links={[
            { label: "Dashboard", href: "/dashboard" },
            { label: "New project", href: "/dashboard/new" },
            { label: "Export history", href: "/dashboard/exports" },
            { label: "Billing", href: "/dashboard/billing" },
          ]}
        />
        <FooterColumn
          title="Legal & docs"
          links={[
            { label: "README / self-host", href: "/#faq" },
            { label: "Acceptable use", href: "/#faq" },
            { label: "Privacy", href: "/#faq" },
            { label: "Terms", href: "/#faq" },
          ]}
        />
      </div>

      <div className="border-t border-white/8">
        <div className="mx-auto flex w-full max-w-7xl flex-col items-center justify-between gap-3 px-5 py-5 text-[11.5px] text-white/35 sm:flex-row sm:px-8">
          <p>© {new Date().getFullYear()} Clipwave. Viral scores are AI estimates, not guarantees.</p>
          <p className="flex items-center gap-1.5">
            <BookOpen className="size-3.5" /> Only public, authorized sources are supported.
          </p>
        </div>
      </div>
    </footer>
  );
}

function FooterColumn({
  title,
  links,
}: {
  title: string;
  links: { label: string; href: string }[];
}) {
  return (
    <div>
      <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-white/35">{title}</p>
      <ul className="mt-3 space-y-2">
        {links.map((link) => (
          <li key={link.label}>
            <Link
              href={link.href}
              className="text-[12.5px] text-white/50 transition hover:text-white"
            >
              {link.label}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
