"use client";

import { motion, useScroll, useTransform } from "framer-motion";
import { Menu, X } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { Logo } from "@/components/brand";
import { LinkButton } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const LINKS = [
  { href: "#features", label: "Features" },
  { href: "#how-it-works", label: "How it works" },
  { href: "#demo", label: "Demo" },
  { href: "#pricing", label: "Pricing" },
  { href: "#faq", label: "FAQ" },
];

export function MarketingNav({ authed }: { authed: boolean }) {
  const { scrollY } = useScroll();
  const [open, setOpen] = useState(false);
  const opacity = useTransform(scrollY, [0, 80], [0, 1]);

  return (
    <header className="fixed inset-x-0 top-0 z-40">
      <motion.div
        style={{ opacity }}
        className="pointer-events-none absolute inset-0 border-b border-white/8 bg-ink-950/70 backdrop-blur-xl"
      />
      <nav className="relative mx-auto flex h-16 w-full max-w-7xl items-center justify-between px-5 sm:px-8">
        <Link href="/" className="shrink-0">
          <Logo />
        </Link>

        <div className="hidden items-center gap-1 md:flex">
          {LINKS.map((link) => (
            <a
              key={link.href}
              href={link.href}
              className="rounded-lg px-3 py-2 text-[13.5px] font-medium text-white/60 transition hover:bg-white/6 hover:text-white"
            >
              {link.label}
            </a>
          ))}
        </div>

        <div className="hidden items-center gap-2.5 md:flex">
          {authed ? (
            <LinkButton href="/dashboard" size="sm" iconRight={<span aria-hidden>→</span>}>
              Dashboard
            </LinkButton>
          ) : (
            <>
              <Link
                href="/login"
                className={cn(
                  "rounded-xl px-3.5 py-2 text-[13.5px] font-medium text-white/70 transition hover:text-white",
                )}
              >
                Sign in
              </Link>
              <LinkButton href="/register" size="sm">
                Start free
              </LinkButton>
            </>
          )}
        </div>

        <button
          onClick={() => setOpen((v) => !v)}
          className="rounded-xl border border-white/10 bg-white/5 p-2 text-white/80 md:hidden"
          aria-label="Toggle menu"
        >
          {open ? <X className="size-5" /> : <Menu className="size-5" />}
        </button>
      </nav>

      {open ? (
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          className="glass-strong mx-4 mt-2 space-y-1 rounded-2xl p-3 md:hidden"
        >
          {LINKS.map((link) => (
            <a
              key={link.href}
              href={link.href}
              onClick={() => setOpen(false)}
              className="block rounded-xl px-3 py-2.5 text-sm text-white/75 hover:bg-white/8 hover:text-white"
            >
              {link.label}
            </a>
          ))}
          <div className="flex gap-2 pt-2">
            <LinkButton href={authed ? "/dashboard" : "/login"} variant="secondary" size="sm" className="flex-1">
              {authed ? "Dashboard" : "Sign in"}
            </LinkButton>
            {!authed ? (
              <LinkButton href="/register" size="sm" className="flex-1">
                Start free
              </LinkButton>
            ) : null}
          </div>
        </motion.div>
      ) : null}
    </header>
  );
}
