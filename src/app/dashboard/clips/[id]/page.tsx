"use client";

import {
  ArrowLeft,
  Captions,
  Check,
  Download,
  Gauge,
  Image as ImageIcon,
  Loader2,
  Save,
  Scissors,
  Sparkles,
  Type,
  Wand2,
} from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { CaptionControls, styleFromPreset, type CaptionDraft } from "@/components/studio/caption-controls";
import { CaptionEditor } from "@/components/studio/caption-editor";
import { CaptionPreview, useVideoTime, type PreviewWord } from "@/components/studio/caption-preview";
import {
  ExportPanel,
  FormatPanel,
  ScorePanel,
  ThumbnailPanel,
  TrimPanel,
} from "@/components/studio/clip-panels";
import { SeoPanel } from "@/components/studio/seo-panel";
import { Badge, ScorePill, StatusDot } from "@/components/ui/badge";
import { Button, LinkButton } from "@/components/ui/button";
import { GlassCard } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/progress";
import { Tabs } from "@/components/ui/tabs";
import { EmptyState } from "@/components/ui/misc";
import { useToast } from "@/components/ui/toast";
import { apiPatch, apiPost, useApi } from "@/lib/client/api";
import { cn, errorMessage, formatTimecode } from "@/lib/utils";
import type { ClipStudioResponse } from "@/lib/contracts";

type TabId = "captions" | "trim" | "format" | "seo" | "score" | "thumbnail" | "export";

const DEFAULT_CAPTION: CaptionDraft = {
  style: "mrbeast",
  fontFamily: "Inter",
  fontSize: 0.062,
  textColor: "#FFFFFF",
  highlightColor: "#5EF0C6",
  outlineColor: "#050510",
  outline: 7,
  shadow: 4,
  position: "bottom",
  uppercase: true,
  emoji: true,
  maxWordsPerLine: 3,
  animation: "pop",
  highlightWords: true,
  speakerLabels: false,
};

export default function ClipStudioPage() {
  const params = useParams<{ id: string }>();
  const clipId = params.id;
  const toast = useToast();

  const { data, loading, refresh } = useApi<ClipStudioResponse>(`/api/clips/${clipId}`, { refreshMs: 4000 });
  const clip = data?.clip;
  const project = data?.project;
  const words = useMemo<PreviewWord[]>(() => data?.words ?? [], [data?.words]);

  const videoRef = useRef<HTMLVideoElement>(null);
  const currentTime = useVideoTime(videoRef);

  const [tab, setTab] = useState<TabId>("captions");
  const [title, setTitle] = useState("");
  const [start, setStart] = useState(0);
  const [end, setEnd] = useState(0);
  const [edits, setEdits] = useState<Record<string, unknown>>({});
  const [caption, setCaption] = useState<CaptionDraft>(DEFAULT_CAPTION);
  const [editedWords, setEditedWords] = useState<PreviewWord[]>([]);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [rendering, setRendering] = useState(false);
  const [regeneratingSeo, setRegeneratingSeo] = useState(false);
  const [initialised, setInitialised] = useState(false);

  useEffect(() => {
    if (!clip || initialised) return;
    setTitle(clip.title ?? "");
    setStart(Number(clip.startSec));
    setEnd(Number(clip.endSec));
    setEdits({
      aspect: project?.aspect ?? "9:16",
      cropMode: "face",
      speed: 1,
      musicId: "",
      musicVolume: 0.18,
      introEnabled: false,
      outroEnabled: false,
      ...(clip.edits ?? {}),
    });
    const stored = clip.subtitleConfig;
    setCaption({
      ...DEFAULT_CAPTION,
      ...(typeof stored?.style === "string" ? styleFromPreset(stored.style, [stored.style]) : {}),
      ...(stored ?? {}),
    });
    setEditedWords(words);
    setInitialised(true);
  }, [clip, project, words, initialised]);

  // Re-sync words if the clip is re-rendered (new word list from the API).
  useEffect(() => {
    if (clip?.status === "ready" && words.length && !dirty) setEditedWords(words);
  }, [words, clip?.status, dirty]);

  const markDirty = () => setDirty(true);

  const updateEdits = (patch: Record<string, unknown>) => {
    setEdits((prev) => ({ ...prev, ...patch }));
    markDirty();
  };

  const updateCaption = (patch: Partial<CaptionDraft>) => {
    if (patch.style) {
      const preset = styleFromPreset(patch.style, planStyles);
      setCaption((prev) => ({ ...prev, ...preset, ...patch }));
    } else {
      setCaption((prev) => ({ ...prev, ...patch }));
    }
    markDirty();
  };

  const plan = data?.plan as
    | { id: string; name: string; subtitleStyles: string[]; maxResolution: number; maxFps: number }
    | undefined;

  /** Styles the backend will actually accept for this account. */
  const planStyles: string[] = useMemo(
    () => plan?.subtitleStyles ?? ["minimal", "podcast"],
    [plan],
  );

  const saveOnly = async () => {
    setSaving(true);
    try {
      await apiPatch(`/api/clips/${clipId}`, {
        title,
        edits,
        subtitleConfig: caption,
        startSec: start,
        endSec: end,
      });
      setDirty(false);
      toast.success("Saved", "Changes stored without re-rendering.");
      await refresh();
    } catch (err: unknown) {
      toast.error(errorMessage(err, "Could not save"));
    } finally {
      setSaving(false);
    }
  };

  const render = async () => {
    setRendering(true);
    try {
      await apiPatch(`/api/clips/${clipId}`, {
        title,
        edits,
        subtitleConfig: caption,
        startSec: start,
        endSec: end,
      });
      const res = await apiPost<{ jobId: string }>(`/api/clips/${clipId}/render`, {
        startSec: start,
        endSec: end,
        subtitleConfig: caption,
        edits: { ...edits, subtitleStyle: caption.style },
        words: editedWords.length ? editedWords : undefined,
      });
      void res;
      setDirty(false);
      toast.success("Re-render queued", "The worker will rebuild this clip — this page updates live.");
      setTimeout(() => void refresh(), 1500);
    } catch (err: unknown) {
      toast.error(errorMessage(err, "Could not re-render"));
    } finally {
      setRendering(false);
    }
  };

  const regenerateSeo = async () => {
    setRegeneratingSeo(true);
    try {
      await apiPost(`/api/clips/${clipId}/seo`);
      toast.success("Metadata regenerating", "Takes a few seconds.");
      setTimeout(() => void refresh(), 2500);
    } catch (err: unknown) {
      toast.error(errorMessage(err, "Could not regenerate"));
    } finally {
      setRegeneratingSeo(false);
    }
  };

  if (loading && !data) {
    return (
      <div className="grid gap-5 lg:grid-cols-[1.35fr_1fr]">
        <Skeleton className="aspect-[9/13] w-full rounded-3xl" />
        <Skeleton className="h-[32rem] w-full rounded-3xl" />
      </div>
    );
  }

  if (!clip) {
    return (
      <EmptyState
        icon={Sparkles}
        title="Clip not found"
        description="It may have been deleted, or the project was removed."
        action={<LinkButton href="/dashboard/clips">Back to library</LinkButton>}
      />
    );
  }

  const isRendering = clip.status === "rendering" || rendering;
  const videoTime = Math.min(currentTime, Math.max(0.1, clip.durationSec));

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
        <Link
          href={`/dashboard/projects/${clip.projectId}`}
          className="inline-flex shrink-0 items-center gap-1.5 text-[12.5px] text-white/45 transition hover:text-white"
        >
          <ArrowLeft className="size-3.5" /> {project?.title ?? "Project"}
        </Link>

        <div className="flex min-w-0 flex-1 items-center gap-2">
          <input
            value={title}
            onChange={(e) => {
              setTitle(e.target.value);
              markDirty();
            }}
            className="w-full truncate rounded-xl border border-transparent bg-transparent px-2 py-1.5 font-display text-lg font-semibold text-white transition hover:border-white/10 focus:border-violet-400/50 focus:bg-ink-900/60 focus:outline-none"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <ScorePill score={clip.viralScore} />
          <Badge tone={clip.status === "ready" ? "mint" : clip.status === "failed" ? "rose" : "electric"}>
            <StatusDot status={clip.status} />
            {clip.status}
          </Badge>
          {dirty ? <Badge tone="amber">unsaved</Badge> : null}
          <Button
            size="sm"
            variant="secondary"
            loading={saving}
            disabled={!dirty}
            onClick={saveOnly}
            icon={<Save className="size-3.5" />}
          >
            Save
          </Button>
          <Button
            size="sm"
            loading={isRendering}
            onClick={render}
            icon={isRendering ? <Loader2 className="size-3.5 animate-spin" /> : <Wand2 className="size-3.5" />}
          >
            {isRendering ? "Rendering…" : "Apply & re-render"}
          </Button>
          <a
            href={`/api/clips/${clipId}/download?kind=video&resolution=1080`}
            className={cn(
              "inline-flex h-9 items-center gap-1.5 rounded-xl border border-white/12 bg-white/6 px-3 text-[12.5px] text-white/75 transition hover:bg-white/12 hover:text-white",
              clip.status !== "ready" && "pointer-events-none opacity-40",
            )}
          >
            <Download className="size-3.5" /> MP4
          </a>
        </div>
      </div>

      <div className="grid gap-5 lg:grid-cols-[1.25fr_1fr] xl:grid-cols-[1.35fr_1fr]">
        {/* Player */}
        <div className="space-y-3">
          <GlassCard className="overflow-hidden p-2.5">
            <div className="relative mx-auto overflow-hidden rounded-2xl bg-black" style={{ maxWidth: 420 }}>
              {clip.videoUrl ? (
                <video
                  ref={videoRef}
                  key={clip.videoUrl}
                  src={clip.videoUrl}
                  poster={clip.posterUrl ?? clip.thumbnailUrl ?? undefined}
                  controls
                  playsInline
                  className="aspect-[9/16] w-full bg-black object-contain"
                />
              ) : (
                <div className="grid aspect-[9/16] w-full place-items-center bg-ink-900 text-center">
                  <div>
                    <Loader2 className="mx-auto size-5 animate-spin text-violet-300" />
                    <p className="mt-2 text-[12px] text-white/40">Rendering your clip…</p>
                  </div>
                </div>
              )}
            </div>

            <div className="mt-2.5 flex flex-wrap items-center justify-between gap-2 px-1 pb-1 text-[11px] text-white/40">
              <span className="inline-flex items-center gap-2">
                <span className="font-mono">{formatTimecode(clip.startSec)}</span>
                <span>→</span>
                <span className="font-mono">{formatTimecode(clip.endSec)}</span>
                <span className="text-white/25">|</span>
                <span>{clip.durationSec.toFixed(1)}s</span>
                <span className="text-white/25">|</span>
                <span className="capitalize">{clip.category}</span>
              </span>
              <span className="inline-flex items-center gap-1.5">
                <Gauge className="size-3" /> {clip.bestPlatform}
              </span>
            </div>
          </GlassCard>

          <GlassCard className="p-3">
            <p className="mb-2 inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-white/40">
              <Captions className="size-3.5" /> Live caption preview
            </p>
            <CaptionPreview
              words={editedWords}
              currentTime={videoTime}
              config={{
                fontFamily: caption.fontFamily,
                fontSize: caption.fontSize,
                textColor: caption.textColor,
                highlightColor: caption.highlightColor,
                outlineColor: caption.outlineColor,
                outline: Math.min(8, caption.outline),
                shadow: caption.shadow,
                position: caption.position,
                uppercase: caption.uppercase,
                maxWordsPerLine: caption.maxWordsPerLine,
                highlightWords: caption.highlightWords,
                animation: caption.animation,
                speakerLabels: caption.speakerLabels,
              }}
            />
            <div className="mt-2 flex items-center justify-between text-[10.5px] text-white/30">
              <span>Synced to the rendered video’s timeline</span>
              <button
                onClick={() => videoRef.current && (videoRef.current.currentTime = 0)}
                className="hover:text-white"
              >
                restart
              </button>
            </div>
          </GlassCard>

          <GlassCard className="p-3">
            <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-white/40">
              Transcript
            </p>
            <p className="max-h-28 overflow-y-auto text-[12px] leading-relaxed text-white/55">
              {clip.transcript || "No speech detected in this range."}
            </p>
          </GlassCard>
        </div>

        {/* Inspector */}
        <GlassCard className="p-4">
          <Tabs
            size="sm"
            tabs={[
              { id: "captions", label: "Captions", icon: <Type className="size-3.5" /> },
              { id: "trim", label: "Trim", icon: <Scissors className="size-3.5" /> },
              { id: "format", label: "Format", icon: <Wand2 className="size-3.5" /> },
              { id: "seo", label: "SEO", icon: <Sparkles className="size-3.5" /> },
              { id: "score", label: "Score", icon: <Gauge className="size-3.5" /> },
              { id: "thumbnail", label: "Cover", icon: <ImageIcon className="size-3.5" /> },
              { id: "export", label: "Export", icon: <Download className="size-3.5" /> },
            ]}
            value={tab}
            onChange={(id) => setTab(id as TabId)}
            className="mb-4 w-full"
          />

          <div className="max-h-[calc(100vh-14rem)] overflow-y-auto pr-1">
            {tab === "captions" ? (
              <div className="space-y-4">
                <CaptionControls
                  draft={caption}
                  update={updateCaption}
                  allowedStyles={planStyles}
                  planName="all styles"
                />
                <CaptionEditor
                  words={editedWords}
                  originalWords={words}
                  onChange={(next) => {
                    setEditedWords(next);
                    markDirty();
                  }}
                  onSeek={(time) => {
                    if (videoRef.current) videoRef.current.currentTime = time;
                  }}
                />
              </div>
            ) : null}

            {tab === "trim" ? (
              <TrimPanel
                start={start}
                end={end}
                aiStart={clip.startSec}
                aiEnd={clip.endSec}
                sourceDuration={project?.durationSec ?? end + 30}
                onChange={(next) => {
                  setStart(next.start);
                  setEnd(next.end);
                  markDirty();
                }}
              />
            ) : null}

            {tab === "format" ? (
              <FormatPanel
                edits={edits}
                update={updateEdits}
                planAllows60fps={(plan?.maxFps ?? 30) >= 60}
              />
            ) : null}

            {tab === "seo" ? (
              <SeoPanel
                seo={clip.seo}
                regenerating={regeneratingSeo}
                onRegenerate={regenerateSeo}
                currentTitle={title}
                onTitleChange={async (next) => {
                  setTitle(next);
                  try {
                    await apiPatch(`/api/clips/${clipId}`, { title: next });
                    toast.success("Title applied");
                    void refresh();
                  } catch {
                    toast.error("Could not update the title");
                  }
                }}
              />
            ) : null}

            {tab === "score" ? <ScorePanel clip={clip} /> : null}

            {tab === "thumbnail" ? (
              <ThumbnailPanel
                clip={clip}
                onUpdated={() => {
                  void refresh();
                }}
              />
            ) : null}

            {tab === "export" ? (
              <ExportPanel
                clip={clip}
                maxResolution={plan?.maxResolution ?? 720}
                planName={plan?.name ?? "Free"}
              />
            ) : null}
          </div>

          {dirty ? (
            <div className="mt-3 flex items-center gap-2 rounded-xl border border-amber-400/25 bg-amber-400/[0.06] px-3 py-2 text-[11px] text-amber-200">
              <Check className="size-3.5 shrink-0" />
              Unsaved changes — Save keeps them, Apply & re-render rebuilds the video.
            </div>
          ) : null}
        </GlassCard>
      </div>
    </div>
  );
}
