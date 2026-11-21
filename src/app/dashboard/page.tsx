"use client";

import {
  ArrowRight,
  Clock,
  Download,
  Film,
  HardDrive,
  ListChecks,
  Plus,
  Sparkles,
  TrendingUp,
  Zap,
} from "lucide-react";
import Link from "next/link";
import { ClipCard } from "@/components/dashboard/clip-card";
import { MiniBars } from "@/components/dashboard/charts";
import { ProjectCard } from "@/components/dashboard/project-card";
import { GlassCard, SectionHeading, StatCard } from "@/components/ui/card";
import { LinkButton } from "@/components/ui/button";
import { Progress, RingProgress, Skeleton } from "@/components/ui/progress";
import { Badge, PlanBadge, StatusDot } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/misc";
import { useApi } from "@/lib/client/api";
import { formatBytes, relativeTime } from "@/lib/utils";

interface DashboardData {
  usage: {
    plan: { id: string; name: string };
    usedMinutes: number;
    includedMinutes: number;
    remainingMinutes: number;
    percent: number;
    clipsThisMonth: number;
    periodStart: string;
    isUnlimited: boolean;
  };
  series: { day: string; minutes: number; clips: number }[];
  stats: {
    projects: number;
    clips: number;
    readyClips: number;
    savedClips: number;
    exports: number;
    processedMinutes: number;
    storageBytes: number;
  };
  recentProjects: any[];
  savedClips: any[];
  queue: any[];
}

export default function DashboardPage() {
  const { data, loading } = useApi<DashboardData>("/api/dashboard", { refreshMs: 12_000 });

  if (loading && !data) {
    return (
      <div className="space-y-5">
        <Skeleton className="h-32 w-full rounded-3xl" />
        <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-28 rounded-3xl" />
          ))}
        </div>
        <Skeleton className="h-64 w-full rounded-3xl" />
      </div>
    );
  }
  if (!data) return null;

  const { usage, stats, series, recentProjects, savedClips, queue } = data;
  const isFree = usage.plan.id === "free";

  return (
    <div className="space-y-6">
      {/* Hero strip */}
      <GlassCard className="relative overflow-hidden p-6 sm:p-8" glow>
        <div className="pointer-events-none absolute -right-16 -top-24 size-72 rounded-full bg-violet-600/25 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-24 left-1/3 size-64 rounded-full bg-electric-500/20 blur-3xl" />
        <div className="relative flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <Badge tone="violet">
                <Sparkles className="size-3" /> {usage.plan.name} plan
              </Badge>
              <span className="text-[11.5px] text-white/35">
                Billing period started {new Date(usage.periodStart).toLocaleDateString()}
              </span>
            </div>
            <h1 className="mt-3 font-display text-2xl font-bold tracking-tight text-white sm:text-[30px]">
              Ready to clip something{" "}
              <span className="gradient-text">worth posting?</span>
            </h1>
            <p className="mt-2 max-w-xl text-[13.5px] leading-relaxed text-white/50">
              Paste a YouTube or Kick link, or upload a file. Clipwave transcribes the whole thing,
              scores every moment and renders vertical clips with captions already burned in.
            </p>
            <div className="mt-5 flex flex-wrap items-center gap-2.5">
              <LinkButton href="/dashboard/new" icon={<Plus className="size-4" />}>
                New project
              </LinkButton>
              <LinkButton href="/dashboard/exports" variant="secondary" icon={<Download className="size-4" />}>
                Export history
              </LinkButton>
            </div>
          </div>

          <div className="glass flex items-center gap-5 rounded-2xl p-4">
            <RingProgress
              value={100 - usage.percent}
              size={74}
              stroke={6}
              color={usage.percent > 85 ? "#FFD84D" : "#5EF0C6"}
              label={usage.isUnlimited ? "∞" : `${Math.max(0, usage.remainingMinutes)}m`}
            />
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wider text-white/40">
                {usage.isUnlimited ? "Admin access" : "Credits remaining"}
              </p>
              <p className="mt-0.5 font-display text-lg font-semibold text-white">
                {usage.isUnlimited ? "Unlimited access" : `${usage.remainingMinutes} of ${usage.includedMinutes} min`}
              </p>
              <p className="mt-1 text-[11.5px] text-white/40">
                {usage.isUnlimited ? "All features unlocked · no monthly caps" : `${usage.usedMinutes} min used · ${usage.clipsThisMonth} clips this month`}
              </p>
              {isFree ? (
                <Link
                  href="/dashboard/billing"
                  className="mt-2 inline-flex items-center gap-1 text-[11.5px] font-medium text-violet-300 hover:text-violet-200"
                >
                  <Zap className="size-3" /> Upgrade for 300 min
                </Link>
              ) : null}
            </div>
          </div>
        </div>
      </GlassCard>

      {/* Stats */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Videos processed"
          value={stats.projects}
          hint={`${stats.processedMinutes} minutes analysed`}
          icon={<Film className="size-4.5" />}
          accent="violet"
        />
        <StatCard
          label="Clips generated"
          value={stats.clips}
          hint={`${stats.readyClips} rendered & ready`}
          icon={<Sparkles className="size-4.5" />}
          accent="electric"
        />
        <StatCard
          label="Exports"
          value={stats.exports}
          hint="MP4 · SRT downloads"
          icon={<Download className="size-4.5" />}
          accent="mint"
        />
        <StatCard
          label="Storage used"
          value={formatBytes(stats.storageBytes)}
          hint="Source media + renders"
          icon={<HardDrive className="size-4.5" />}
          accent="amber"
        />
      </div>

      <div className="grid gap-5 lg:grid-cols-[1.5fr_1fr]">
        {/* Recent projects */}
        <GlassCard className="p-5">
          <SectionHeading
            title="Recent projects"
            description="Every import keeps its transcript, scores and rendered clips."
            action={
              <Link
                href="/dashboard/projects"
                className="inline-flex items-center gap-1 text-[12.5px] text-white/45 transition hover:text-white"
              >
                View all <ArrowRight className="size-3.5" />
              </Link>
            }
          />
          <div className="mt-4">
            {recentProjects.length ? (
              <div className="grid gap-3 sm:grid-cols-2">
                {recentProjects.slice(0, 4).map((project, i) => (
                  <ProjectCard key={project.id} project={project} index={i} />
                ))}
              </div>
            ) : (
              <EmptyState
                icon={Film}
                title="No projects yet"
                description="Your first import takes one paste. Clipwave handles the download, transcription and rendering."
                action={
                  <LinkButton href="/dashboard/new" size="sm" icon={<Plus className="size-4" />}>
                    Create your first project
                  </LinkButton>
                }
              />
            )}
          </div>
        </GlassCard>

        {/* Usage + queue */}
        <div className="space-y-5">
          <GlassCard className="p-5">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-white/40">
                  Processing minutes
                </p>
                <p className="mt-1 font-display text-2xl font-semibold text-white">
                  {usage.isUnlimited ? "Unlimited" : usage.usedMinutes}
                  {!usage.isUnlimited ? (
                    <span className="text-sm text-white/35"> / {usage.includedMinutes} min</span>
                  ) : null}
                </p>
              </div>
              <PlanBadge plan={usage.plan.id} />
            </div>
            {!usage.isUnlimited ? <Progress value={usage.percent} className="mt-3" showValue /> : null}
            <div className="mt-4">
              <p className="mb-2 inline-flex items-center gap-1.5 text-[11.5px] text-white/40">
                <TrendingUp className="size-3.5" /> Last 14 days
              </p>
              <MiniBars data={series} height={64} />
            </div>
          </GlassCard>

          <GlassCard className="p-5">
            <div className="flex items-center justify-between">
              <p className="inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-white/40">
                <ListChecks className="size-3.5" /> Live queue
              </p>
              <Link href="/dashboard/queue" className="text-[11.5px] text-white/40 hover:text-white">
                All jobs
              </Link>
            </div>
            <div className="mt-3 space-y-2">
              {queue.length ? (
                queue.slice(0, 4).map((job) => (
                  <Link
                    key={job.id}
                    href={job.projectId ? `/dashboard/projects/${job.projectId}` : "/dashboard/queue"}
                    className="block rounded-xl border border-white/8 bg-white/[0.03] p-2.5 transition hover:border-violet-400/25"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="inline-flex items-center gap-1.5 truncate text-[12px] text-white/85">
                        <StatusDot status={job.status} />
                        <span className="truncate">{job.projectTitle ?? job.type}</span>
                      </span>
                      <span className="shrink-0 font-mono text-[10.5px] text-white/35">
                        {job.progress}%
                      </span>
                    </div>
                    <p className="mt-1 truncate text-[10.5px] text-white/35">
                      {job.stage ?? "Queued"}
                    </p>
                    <Progress value={job.progress} className="mt-1.5" />
                  </Link>
                ))
              ) : (
                <p className="rounded-xl border border-dashed border-white/10 px-3 py-6 text-center text-[12px] text-white/35">
                  Nothing processing right now.
                </p>
              )}
            </div>
          </GlassCard>
        </div>
      </div>

      {/* Saved clips */}
      <GlassCard className="p-5">
        <SectionHeading
          title="Saved clips"
          description="Bookmark the ones you want to post later."
          action={
            <Link
              href="/dashboard/clips"
              className="inline-flex items-center gap-1 text-[12.5px] text-white/45 transition hover:text-white"
            >
              Library <ArrowRight className="size-3.5" />
            </Link>
          }
        />
        <div className="mt-4">
          {savedClips.length ? (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
              {savedClips.map((clip, i) => (
                <ClipCard key={clip.id} clip={clip} index={i} />
              ))}
            </div>
          ) : (
            <p className="rounded-2xl border border-dashed border-white/10 px-4 py-8 text-center text-[12.5px] text-white/35">
              No saved clips yet — tap the bookmark on any clip to keep it here.
            </p>
          )}
        </div>
      </GlassCard>
    </div>
  );
}
