"use client";

import { AnimatePresence, motion } from "framer-motion";
import {
  BarChart3,
  ChevronRight,
  CreditCard,
  Film,
  LayoutDashboard,
  LogOut,
  Menu,
  Plus,
  Settings,
  Shield,
  Sparkles,
  Download,
  ListChecks,
  X,
} from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Logo } from "@/components/brand";
import { Badge, PlanBadge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { LinkButton } from "@/components/ui/button";
import { cn, initials } from "@/lib/utils";
import { apiPost } from "@/lib/client/api";

export interface ShellUser {
  id: string;
  email: string;
  name: string | null;
  avatarUrl: string | null;
  role: string;
  plan: string;
}

export interface ShellUsage {
  usedMinutes: number;
  includedMinutes: number;
  remainingMinutes: number;
  percent: number;
  isUnlimited: boolean;
}

const NAV = [
  { href: "/dashboard", label: "Overview", icon: LayoutDashboard },
  { href: "/dashboard/new", label: "New project", icon: Plus },
  { href: "/dashboard/projects", label: "Projects", icon: Film },
  { href: "/dashboard/clips", label: "Saved clips", icon: Sparkles },
  { href: "/dashboard/queue", label: "Processing", icon: ListChecks },
  { href: "/dashboard/exports", label: "Exports", icon: Download },
];

const SECONDARY = [
  { href: "/dashboard/billing", label: "Billing & usage", icon: CreditCard },
  { href: "/dashboard/settings", label: "Settings", icon: Settings },
];

export function DashboardShell({
  user,
  usage,
  children,
}: {
  user: ShellUser;
  usage: ShellUsage;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    setMobileOpen(false);
    setMenuOpen(false);
  }, [pathname]);

  const logout = async () => {
    await apiPost("/api/auth/logout").catch(() => {});
    router.push("/");
    router.refresh();
  };

  const nav = user.role === "admin" ? [...NAV, { href: "/dashboard/admin", label: "Admin", icon: Shield }] : NAV;

  return (
    <div className="relative min-h-screen">
      <div className="pointer-events-none fixed inset-0 -z-10">
        <div className="absolute -left-40 -top-32 size-[34rem] rounded-full bg-violet-600/12 blur-[130px]" />
        <div className="absolute right-[-10%] top-1/3 size-[30rem] rounded-full bg-electric-500/10 blur-[130px]" />
      </div>

      {/* Sidebar */}
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-[248px] flex-col border-r border-white/8 bg-ink-950/70 backdrop-blur-xl lg:flex">
        <div className="flex h-16 items-center px-5">
          <Link href="/dashboard">
            <Logo />
          </Link>
        </div>

        <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-3">
          {nav.map((item) => (
            <NavItem key={item.href} item={item} active={isActive(pathname, item.href)} />
          ))}
          <div className="my-3 h-px bg-white/8" />
          {SECONDARY.map((item) => (
            <NavItem key={item.href} item={item} active={isActive(pathname, item.href)} />
          ))}
        </nav>

        <div className="p-3">
          <div className="glass rounded-2xl p-3.5">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-white/40">
                {usage.isUnlimited ? "Admin access" : "Monthly credits"}
              </span>
              <PlanBadge plan={user.plan} />
            </div>
            <div className="mt-2 flex items-baseline gap-1">
              <span className="font-display text-xl font-semibold text-white">
                {usage.isUnlimited ? "Unlimited" : Math.max(0, usage.remainingMinutes)}
              </span>
              {!usage.isUnlimited ? (
                <span className="text-[11px] text-white/40">/ {usage.includedMinutes} min left</span>
              ) : null}
            </div>
            {!usage.isUnlimited ? (
              <Progress value={usage.percent} className="mt-2" tone={usage.percent > 85 ? "violet" : "mint"} />
            ) : (
              <p className="mt-2 text-[11px] text-white/35">No monthly usage cap</p>
            )}
            {user.plan !== "ultimate" ? (
              <Link
                href="/dashboard/billing"
                className="mt-3 flex items-center justify-between rounded-xl border border-violet-400/25 bg-violet-500/12 px-2.5 py-1.5 text-[11.5px] font-medium text-violet-200 transition hover:bg-violet-500/20"
              >
                Upgrade plan <ChevronRight className="size-3.5" />
              </Link>
            ) : null}
          </div>

          <button
            onClick={logout}
            className="mt-3 flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-[13px] text-white/45 transition hover:bg-white/6 hover:text-white"
          >
            <LogOut className="size-4" /> Sign out
          </button>
        </div>
      </aside>

      {/* Mobile drawer */}
      <AnimatePresence>
        {mobileOpen ? (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-40 bg-ink-950/80 backdrop-blur-sm lg:hidden"
              onClick={() => setMobileOpen(false)}
            />
            <motion.aside
              initial={{ x: -280 }}
              animate={{ x: 0 }}
              exit={{ x: -280 }}
              transition={{ type: "spring", stiffness: 320, damping: 32 }}
              className="glass-strong fixed inset-y-0 left-0 z-50 flex w-[264px] flex-col lg:hidden"
            >
              <div className="flex h-16 items-center justify-between px-4">
                <Logo />
                <button onClick={() => setMobileOpen(false)} className="rounded-lg p-2 text-white/50">
                  <X className="size-5" />
                </button>
              </div>
              <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-3">
                {nav.map((item) => (
                  <NavItem key={item.href} item={item} active={isActive(pathname, item.href)} />
                ))}
                <div className="my-3 h-px bg-white/8" />
                {SECONDARY.map((item) => (
                  <NavItem key={item.href} item={item} active={isActive(pathname, item.href)} />
                ))}
              </nav>
              <div className="p-3">
                <button
                  onClick={logout}
                  className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-[13px] text-white/50 hover:bg-white/6"
                >
                  <LogOut className="size-4" /> Sign out
                </button>
              </div>
            </motion.aside>
          </>
        ) : null}
      </AnimatePresence>

      {/* Main */}
      <div className="lg:pl-[248px]">
        <header className="sticky top-0 z-30 border-b border-white/8 bg-ink-950/70 backdrop-blur-xl">
          <div className="flex h-16 items-center gap-3 px-4 sm:px-6">
            <button
              onClick={() => setMobileOpen(true)}
              className="rounded-xl border border-white/10 bg-white/5 p-2 text-white/70 lg:hidden"
              aria-label="Open menu"
            >
              <Menu className="size-5" />
            </button>

            <div className="hidden items-center gap-2 text-[13px] text-white/40 sm:flex">
              <BarChart3 className="size-4" />
              <span>{titleFor(pathname)}</span>
            </div>

            <div className="ml-auto flex items-center gap-2">
              <LinkButton
                href="/dashboard/new"
                size="sm"
                icon={<Plus className="size-4" />}
                className="hidden sm:inline-flex"
              >
                New project
              </LinkButton>
              <div className="relative">
                <button
                  onClick={() => setMenuOpen((v) => !v)}
                  className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 py-1.5 pl-1.5 pr-2.5 transition hover:bg-white/10"
                >
                  {user.avatarUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={user.avatarUrl} alt="" className="size-7 rounded-lg object-cover" />
                  ) : (
                    <span className="grid size-7 place-items-center rounded-lg bg-gradient-to-br from-violet-500 to-electric-500 text-[11px] font-bold text-white">
                      {initials(user.name, user.email)}
                    </span>
                  )}
                  <span className="hidden max-w-[120px] truncate text-[12.5px] text-white/75 sm:block">
                    {user.name ?? user.email}
                  </span>
                </button>

                <AnimatePresence>
                  {menuOpen ? (
                    <motion.div
                      initial={{ opacity: 0, y: -6, scale: 0.98 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: -6, scale: 0.98 }}
                      className="glass-strong absolute right-0 top-12 z-50 w-56 overflow-hidden rounded-2xl p-1.5 shadow-2xl"
                    >
                      <div className="px-2.5 py-2">
                        <p className="truncate text-[12.5px] font-medium text-white">
                          {user.name ?? "Creator"}
                        </p>
                        <p className="truncate text-[11px] text-white/40">{user.email}</p>
                        <div className="mt-1.5 flex items-center gap-1.5">
                          <PlanBadge plan={user.plan} />
                          {user.role === "admin" ? <Badge tone="rose">Admin</Badge> : null}
                        </div>
                      </div>
                      <div className="my-1 h-px bg-white/8" />
                      <Link href="/dashboard/settings" className="menu-item">
                        <Settings className="size-4" /> Account settings
                      </Link>
                      <Link href="/dashboard/billing" className="menu-item">
                        <CreditCard className="size-4" /> Billing & usage
                      </Link>
                      {user.role === "admin" ? (
                        <Link href="/dashboard/admin" className="menu-item">
                          <Shield className="size-4" /> Admin dashboard
                        </Link>
                      ) : null}
                      <div className="my-1 h-px bg-white/8" />
                      <button
                        onClick={logout}
                        className="menu-item w-full text-left text-rose-300 hover:bg-rose-500/10"
                      >
                        <LogOut className="size-4" /> Sign out
                      </button>
                    </motion.div>
                  ) : null}
                </AnimatePresence>
              </div>
            </div>
          </div>
        </header>

        <main className="mx-auto w-full max-w-[1400px] px-4 py-6 sm:px-6 sm:py-8">{children}</main>
      </div>

      <style jsx global>{`
        .menu-item {
          display: flex;
          align-items: center;
          gap: 0.6rem;
          border-radius: 0.7rem;
          padding: 0.55rem 0.7rem;
          font-size: 12.5px;
          color: rgba(255, 255, 255, 0.6);
          transition: background 0.15s ease, color 0.15s ease;
        }
        .menu-item:hover {
          background: rgba(255, 255, 255, 0.07);
          color: #fff;
        }
      `}</style>
    </div>
  );
}

function NavItem({
  item,
  active,
}: {
  item: { href: string; label: string; icon: React.ComponentType<{ className?: string }> };
  active: boolean;
}) {
  return (
    <Link
      href={item.href}
      className={cn(
        "group relative flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-[13px] font-medium transition-colors",
        active ? "text-white" : "text-white/50 hover:bg-white/5 hover:text-white/85",
      )}
    >
      {active ? (
        <motion.span
          layoutId="nav-active"
          className="absolute inset-0 rounded-xl border border-violet-400/25 bg-gradient-to-r from-violet-500/22 to-electric-500/10"
          transition={{ type: "spring", stiffness: 400, damping: 34 }}
        />
      ) : null}
      <item.icon
        className={cn(
          "relative size-4.5 transition-colors",
          active ? "text-violet-200" : "text-white/40 group-hover:text-white/70",
        )}
      />
      <span className="relative">{item.label}</span>
    </Link>
  );
}

function isActive(pathname: string, href: string) {
  if (href === "/dashboard") return pathname === "/dashboard";
  return pathname === href || pathname.startsWith(`${href}/`);
}

function titleFor(pathname: string) {
  if (pathname.startsWith("/dashboard/projects/")) return "Project detail";
  const match = pathname.replace("/dashboard", "").replace("/", "");
  if (!match) return "Overview";
  return match.charAt(0).toUpperCase() + match.slice(1);
}
