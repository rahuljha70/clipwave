"use client";

import { AnimatePresence, motion } from "framer-motion";
import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  Clock,
  Download,
  Film,
  Languages,
  Loader2,
  RefreshCw,
  Sparkles,
  Trash2,
} from "lucide-react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { ClipCard } from "@/components/dashboard/clip-card";
import { GlassCard, StatCard } from "@/components/ui/card";
import { Badge, PlatformBadge, ScorePill, StatusDot } from "@/components/ui/badge";
import { Button, LinkButton } from "@/components/ui/button";
import { RingProgress, Skeleton } from "@/components/ui/progress";
import { Tabs } from "@/components/ui/tabs";
import { EmptyState } from "@/components/ui/misc";
import { useToast } from "@/components/ui/toast";
import { apiDelete, apiPost, useApi } from "@/lib/client/api";
import { cn, errorMessage, formatDuration, relativeTime } from "@/lib/utils";
import { KickGlyph, YouTubeGlyph } from "@/components/marketing/url-import";
import type { ProjectDetailsResponse } from "@/lib/contracts";
import type { ClipDto } from "@/lib/clip-utils";

const EMPTY_CLIPS: ClipDto[] = [];

const STAGES = [
  { key: "fetch", label: "Fetch source", match: /fetch/i },
  { key: "inspect", label: "Inspect video", match: /inspect/i },
  { key: "transcribe", label: "Transcribe", match: /transcrib/i },
  { key: "analyse", label: "Analyse audio", match: /analys|energy/i },
  { key: "detect", label: "Detect moments", match: /detect|scored|moment/i },
  { key: "render", label: "Render clips", match: /render|tracking/i },
  { key: "done", label: "Finish", match: /ready|finish/i },
];

export default function ProjectDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const toast = useToast();
  const projectId = params.id;
  const [tab, setTab] = useState<"clips" | "analysis" | "logs" | "exports">("clips");
  const [busy, setBusy] = useState(false);

  const { data, loading } = useApi<ProjectDetailsResponse>(`/api/projects/${projectId}`, { refreshMs: 3000 });
  const project = data?.project;
  const clips = data?.clips ?? EMPTY_CLIPS;
  const isProcessing = project?.status === "processing" || project?.status === "queued";

  const stats = useMemo(() => {
    const ready = clips.filter((c) => c.status === "ready");
    const avg = ready.length
      ? Math.round(ready.reduce((sum, c) => sum + c.viralScore, 0) / ready.length)
      : 0;
    return {
      total: clips.length,
      ready: ready.length,
      avg,
      top: ready.reduce((max, c) => Math.max(max, c.viralScore), 0),
      totalSeconds: ready.reduce((sum, c) => sum + c.durationSec, 0),
    };
  }, [clips]);

  const retry = async () => {
    setBusy(true);
    try {
      await apiPost(`/api/projects/${projectId}/progress`, { action: "retry" });
      toast.success("Retry queued");
    } catch (err: unknown) {
      toast.error(errorMessage(err, "Could not retry"));
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    if (!confirm("Delete this project and all of its clips? This cannot be undone.")) return;
    setBusy(true);
    try {
      await apiDelete(`/api/projects/${projectId}`);
      toast.success("Project deleted");
      router.push("/dashboard/projects");
    } catch (err: unknown) {
      toast.error(errorMessage(err, "Could not delete"));
      setBusy(false);
    }
  };

  const exportAll = async () => {
    for (const clip of clips.filter((c) => c.status === "ready")) {
      window.open(`/api/clips/${clip.id}/download?kind=video&resolution=1080`, "_blank");
      await new Promise((r) => setTimeout(r, 900));
    }
  };

  if (loading && !data) {
    return (
      <div className="space-y-5">
        <Skeleton className="h-40 w-full rounded-3xl" />
        <div className="grid gap-4 sm:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-24 rounded-3xl" />
          ))}
        </div>
        <Skeleton className="h-72 w-full rounded-3xl" />
      </div>
    );
  }

  if (!project) {
    return (
      <EmptyState
        icon={Film}
        title="Project not found"
        description="It may have been deleted, or it belongs to another account."
        action={<LinkButton href="/dashboard/projects">Back to projects</LinkButton>}
      />
    );
  }

  const analysis = project.analysis?.analysis;

  return (
    <div className="space-y-5">
      <Link
        href="/dashboard/projects"
        className="inline-flex items-center gap-1.5 text-[12.5px] text-white/45 transition hover:text-white"
      >
        <ArrowLeft className="size-3.5" /> All projects
      </Link>

      {/* Header */}
      <GlassCard className="overflow-hidden">
        <div className="flex flex-col gap-5 p-5 sm:flex-row sm:items-start">
          <div className="relative h-28 w-full shrink-0 overflow-hidden rounded-2xl bg-ink-900 sm:h-24 sm:w-44">
            {project.thumbnailUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={project.thumbnailUrl}
                alt=""
                referrerPolicy="no-referrer"
                className="size-full object-cover"
              />
            ) : (
              <div className="grid size-full place-items-center">
                <Film className="size-6 text-white/25" />
              </div>
            )}
          </div>

          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <PlatformBadge platform={project.platform} />
              <Badge tone={project.status === "ready" ? "mint" : project.status === "failed" ? "rose" : "electric"}>
                <StatusDot status={project.status} />
                {project.status}
              </Badge>
              {project.language ? (
                <Badge tone="neutral">
                  <Languages className="size-3" /> {project.language}
                </Badge>
              ) : null}
              <span className="text-[11.5px] text-white/35">{relativeTime(project.createdAt)}</span>
            </div>

            <h1 className="mt-2 font-display text-xl font-bold leading-snug tracking-tight text-white sm:text-2xl">
              {project.title}
            </h1>

            <div className="mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-[12px] text-white/45">
              {project.channel ? <span>{project.channel}</span> : null}
              <span className="inline-flex items-center gap-1">
                <Clock className="size-3" /> {formatDuration(project.durationSec)}
              </span>
              <span>{project.readyClips} clips ready</span>
              <span>target {project.targetLength}s · {project.aspect}</span>
            </div>

            {project.error ? (
              <div className="mt-3 flex items-start gap-2 rounded-xl border border-rose-400/25 bg-rose-500/10 px-3 py-2 text-[12px] text-rose-200">
                <AlertTriangle className="mt-0.5 size-3.5 shrink-0" />
                <span>{project.error}</span>
              </div>
            ) : null}
          </div>

          <div className="flex shrink-0 flex-wrap items-center gap-2">
            {project.sourceUrl ? (
              <a
                href={project.sourceUrl}
                target="_blank"
                rel="noreferrer noopener"
                className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-white/12 bg-white/5 px-3 text-[12.5px] text-white/70 transition hover:bg-white/10 hover:text-white"
              >
                {project.platform === "youtube" ? (
                  <YouTubeGlyph className="size-3.5" />
                ) : project.platform === "kick" ? (
                  <KickGlyph className="size-3.5" />
                ) : (
                  <Film className="size-3.5" />
                )}
                Source
              </a>
            ) : null}
            {project.status === "failed" || project.status === "canceled" ? (
              <Button size="sm" variant="secondary" loading={busy} onClick={retry} icon={<RefreshCw className="size-3.5" />}>
                Retry
              </Button>
            ) : null}
            {stats.ready > 0 ? (
              <Button size="sm" onClick={exportAll} icon={<Download className="size-3.5" />}>
                Export all
              </Button>
            ) : null}
            <Button
              size="sm"
              variant="ghost"
              onClick={remove}
              className="text-rose-300 hover:bg-rose-500/10"
              icon={<Trash2 className="size-3.5" />}
            >
              Delete
            </Button>
          </div>
        </div>
      </GlassCard>

      {/* Live processing */}
      <AnimatePresence>
        {isProcessing ? (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }}>
            <GlassCard className="p-5" glow>
              <div className="flex flex-col gap-5 sm:flex-row sm:items-center">
                <div className="flex items-center gap-4">
                  <RingProgress value={project.progress} size={68} stroke={6} color="#8B7BFF" />
                  <div>
                    <p className="inline-flex items-center gap-2 text-[13px] font-semibold text-white">
                      <Loader2 className="size-4 animate-spin text-violet-300" />
                      {project.stage ?? "Queued"}
                    </p>
                    <p className="mt-0.5 text-[11.5px] text-white/45">
                      The worker keeps running even if you close this tab.
                    </p>
                  </div>
                </div>

                <div className="flex flex-1 flex-wrap gap-1.5">
                  {STAGES.map((stage, i) => {
                    const activeIndex = STAGES.findIndex((s) => s.match.test(project.stage ?? ""));
                    const done = activeIndex > i || project.status === "ready";
                    const current = activeIndex === i;
                    return (
                      <span
                        key={stage.key}
                        className={cn(
                          "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] transition",
                          done
                            ? "border-mint-400/30 bg-mint-400/10 text-mint-300"
                            : current
                              ? "border-violet-400/40 bg-violet-500/15 text-white"
                              : "border-white/8 bg-white/[0.03] text-white/35",
                        )}
                      >
                        {done ? <CheckCircle2 className="size-3" /> : current ? <Loader2 className="size-3 animate-spin" /> : null}
                        {stage.label}
                      </span>
                    );
                  })}
                </div>
              </div>

              {data?.logs?.length ? (
                <div className="mt-4 max-h-32 overflow-y-auto rounded-xl border border-white/8 bg-ink-950/50 p-3 font-mono text-[10.5px] leading-relaxed text-white/45">
                  {data.logs.slice(-14).map((log, i) => (
                    <p key={i} className={log.level === "error" ? "text-rose-300/80" : ""}>
                      <span className="text-white/25">
                        {new Date(log.created_at).toLocaleTimeString()}{" "}
                      </span>
                      {log.message}
                    </p>
                  ))}
                </div>
              ) : null}
            </GlassCard>
          </motion.div>
        ) : null}
      </AnimatePresence>

      {/* Stats */}
      {!isProcessing ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard label="Clips ready" value={stats.ready} hint={`${stats.total} detected`} icon={<Sparkles className="size-4.5" />} />
          <StatCard label="Average score" value={stats.avg} hint="AI engagement estimate" icon={<Film className="size-4.5" />} accent="electric" />
          <StatCard label="Top clip" value={stats.top} hint="Highest viral potential" icon={<RefreshCw className="size-4.5" />} accent="mint" />
          <StatCard
            label="Short-form output"
            value={`${Math.round(stats.totalSeconds)}s`}
            hint="Across all clips"
            icon={<Clock className="size-4.5" />}
            accent="amber"
          />
        </div>
      ) : null}

      {/* Tabs */}
      <div className="flex items-center justify-between gap-3">
        <Tabs
          tabs={[
            { id: "clips", label: `Clips${stats.ready ? ` (${stats.ready})` : ""}` },
            { id: "analysis", label: "Highlight list" },
            { id: "logs", label: "Processing log" },
            { id: "exports", label: "Exports" },
          ]}
          value={tab}
          onChange={(id) => setTab(id as typeof tab)}
        />
        {analysis ? (
          <span className="hidden text-[11.5px] text-white/35 sm:block">
            {analysis.mode === "acoustic" ? "Acoustic analysis" : "Transcript analysis"} ·{" "}
            {analysis.sentences ?? 0} sentences · baseline {analysis.baselineDb ?? "—"} dB
          </span>
        ) : null}
      </div>

      {tab === "clips" ? (
        clips.length ? (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
            {clips.map((clip, i) => (
              <ClipCard key={clip.id} clip={clip} index={i} />
            ))}
          </div>
        ) : isProcessing ? (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
            {Array.from({ length: Math.min(6, project.requestedClips || 6) }).map((_, i) => (
              <Skeleton key={i} className="aspect-[9/16] rounded-2xl" />
            ))}
          </div>
        ) : (
          <EmptyState
            icon={Sparkles}
            title="No clips were produced"
            description={project.error ?? "Try a longer source or a different clip length."}
            action={
              <Button variant="secondary" onClick={retry} loading={busy} icon={<RefreshCw className="size-4" />}>
                Retry processing
              </Button>
            }
          />
        )
      ) : null}

      {tab === "analysis" ? (
        <GlassCard className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-left">
              <thead>
                <tr className="border-b border-white/8 text-[10.5px] uppercase tracking-wider text-white/35">
                  <th className="px-4 py-2.5 font-semibold">#</th>
                  <th className="px-4 py-2.5 font-semibold">Timestamp</th>
                  <th className="px-4 py-2.5 font-semibold">Hook</th>
                  <th className="px-4 py-2.5 font-semibold">Category</th>
                  <th className="px-4 py-2.5 font-semibold">Score</th>
                  <th className="px-4 py-2.5 font-semibold">Why</th>
                </tr>
              </thead>
              <tbody>
                {(project.moments ?? []).map((moment, i) => (
                  <tr key={i} className="border-b border-white/5 text-[12px] text-white/65 hover:bg-white/[0.03]">
                    <td className="px-4 py-2.5 text-white/30">{i + 1}</td>
                    <td className="whitespace-nowrap px-4 py-2.5 font-mono text-[11px] text-white/45">
                      {formatDuration(moment.start)} – {formatDuration(moment.end)}
                    </td>
                    <td className="max-w-[220px] truncate px-4 py-2.5 text-white/80">{moment.hook}</td>
                    <td className="px-4 py-2.5 capitalize">{moment.category}</td>
                    <td className="px-4 py-2.5">
                      <ScorePill score={moment.score} size="sm" />
                    </td>
                    <td className="max-w-[280px] px-4 py-2.5 text-[11px] text-white/40">{moment.reason}</td>
                  </tr>
                ))}
                {!(project.moments ?? []).length ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-10 text-center text-[12.5px] text-white/35">
                      Moment scores appear once analysis finishes.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </GlassCard>
      ) : null}

      {tab === "logs" ? (
        <GlassCard className="p-4">
          <div className="max-h-[28rem] overflow-y-auto rounded-xl bg-ink-950/60 p-4 font-mono text-[11px] leading-relaxed">
            {(data?.logs ?? []).map((log, i) => (
              <p key={i} className={log.level === "error" ? "text-rose-300/85" : "text-white/50"}>
                <span className="text-white/25">{new Date(log.created_at).toLocaleTimeString()} </span>
                {log.message}
              </p>
            ))}
            {!(data?.logs ?? []).length ? (
              <p className="text-white/30">No log entries yet.</p>
            ) : null}
          </div>
        </GlassCard>
      ) : null}

      {tab === "exports" ? (
        <GlassCard className="p-4">
          {(data?.exports ?? []).length ? (
            <div className="divide-y divide-white/6">
              {data.exports.map((exp) => (
                <div key={exp.id} className="flex items-center justify-between gap-3 py-2.5">
                  <div className="min-w-0">
                    <p className="truncate text-[12.5px] text-white/80">{exp.label ?? "Export"}</p>
                    <p className="text-[11px] text-white/35">
                      {exp.kind} · {exp.resolution ?? "—"} · {relativeTime(exp.created_at)}
                    </p>
                  </div>
                  {exp.clip_id ? (
                    <a
                      href={`/api/clips/${exp.clip_id}/download?kind=${exp.kind === "srt" ? "srt" : "video"}`}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/5 px-2.5 py-1.5 text-[11.5px] text-white/70 hover:text-white"
                    >
                      <Download className="size-3.5" /> Download
                    </a>
                  ) : null}
                </div>
              ))}
            </div>
          ) : (
            <p className="py-8 text-center text-[12.5px] text-white/35">
              No exports from this project yet.
            </p>
          )}
        </GlassCard>
      ) : null}
    </div>
  );
}
