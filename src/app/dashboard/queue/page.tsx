"use client";

import { Activity, ListChecks, RefreshCw } from "lucide-react";
import Link from "next/link";
import { GlassCard } from "@/components/ui/card";
import { Badge, StatusDot } from "@/components/ui/badge";
import { Progress, Skeleton } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/misc";
import { useApi } from "@/lib/client/api";
import { relativeTime } from "@/lib/utils";

export default function QueuePage() {
  const { data, loading, refresh } = useApi<{ projects: any[] }>("/api/projects?limit=100", {
    refreshMs: 4000,
  });

  const active = (data?.projects ?? []).filter(
    (p) => p.status === "processing" || p.status === "queued",
  );
  const recent = (data?.projects ?? []).filter(
    (p) => p.status !== "processing" && p.status !== "queued",
  );

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold tracking-tight text-white">Processing</h1>
          <p className="mt-1 text-[13px] text-white/50">
            Live worker activity. Progress updates every few seconds.
          </p>
        </div>
        <Button variant="secondary" size="sm" onClick={() => void refresh()} icon={<RefreshCw className="size-4" />}>
          Refresh
        </Button>
      </div>

      <GlassCard className="p-5">
        <div className="flex items-center gap-2">
          <Activity className="size-4 text-mint-400" />
          <h2 className="text-[13.5px] font-semibold text-white">Active jobs</h2>
          <Badge tone={active.length ? "electric" : "neutral"}>{active.length}</Badge>
        </div>

        <div className="mt-4 space-y-3">
          {loading && !data ? (
            <Skeleton className="h-24 w-full rounded-2xl" />
          ) : active.length ? (
            active.map((project) => (
              <Link
                key={project.id}
                href={`/dashboard/projects/${project.id}`}
                className="block rounded-2xl border border-white/8 bg-white/[0.03] p-4 transition hover:border-violet-400/25"
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-[13px] font-medium text-white">{project.title}</p>
                    <p className="mt-0.5 inline-flex items-center gap-1.5 text-[11.5px] text-white/45">
                      <StatusDot status={project.status} /> {project.stage ?? "Queued"}
                    </p>
                  </div>
                  <span className="shrink-0 font-mono text-[11px] text-white/40">
                    {project.progress}%
                  </span>
                </div>
                <Progress value={project.progress} className="mt-3" />
              </Link>
            ))
          ) : (
            <EmptyState
              icon={ListChecks}
              title="The queue is empty"
              description="Start a project and its live progress will appear here."
            />
          )}
        </div>
      </GlassCard>

      <GlassCard className="p-5">
        <h2 className="text-[13.5px] font-semibold text-white">Recently finished</h2>
        <div className="mt-3 divide-y divide-white/6">
          {recent.slice(0, 12).map((project) => (
            <Link
              key={project.id}
              href={`/dashboard/projects/${project.id}`}
              className="flex items-center justify-between gap-3 py-2.5 transition hover:opacity-80"
            >
              <div className="flex min-w-0 items-center gap-2.5">
                <StatusDot status={project.status} />
                <span className="truncate text-[12.5px] text-white/80">{project.title}</span>
              </div>
              <span className="shrink-0 text-[11px] text-white/35">
                {project.readyClips} clips · {relativeTime(project.createdAt)}
              </span>
            </Link>
          ))}
          {!recent.length && !loading ? (
            <p className="py-6 text-center text-[12.5px] text-white/30">Nothing here yet.</p>
          ) : null}
        </div>
      </GlassCard>
    </div>
  );
}
