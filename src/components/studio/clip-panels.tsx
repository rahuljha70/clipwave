"use client";

import {
  Crop,
  Lock,
  Download,
  FileVideo,
  Gauge,
  Image as ImageIcon,
  Plus,
  RotateCcw,
  Scissors,
  Sparkles,
  Upload,
  Zap,
} from "lucide-react";
import { useRef, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label, Select, Slider, Switch } from "@/components/ui/field";
import { RingProgress } from "@/components/ui/progress";
import { useToast } from "@/components/ui/toast";
import { cn, errorMessage, formatTimecode, scoreTone } from "@/lib/utils";
import type { ClipDto } from "@/lib/clip-utils";

/* -------------------------------- Trim ----------------------------------- */

export function TrimPanel({
  start,
  end,
  onChange,
  aiStart,
  aiEnd,
  sourceDuration,
}: {
  start: number;
  end: number;
  onChange: (next: { start: number; end: number }) => void;
  aiStart: number;
  aiEnd: number;
  sourceDuration: number;
}) {
  const duration = Math.max(0, end - start);
  const max = Math.max(sourceDuration || aiEnd + 30, end + 5);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="inline-flex items-center gap-1.5 text-[12px] font-semibold text-white/80">
          <Scissors className="size-3.5 text-violet-300" /> Trim
        </h3>
        <Badge tone={duration > 90 ? "amber" : "mint"}>{duration.toFixed(1)}s</Badge>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div>
          <Label hint="in">Start</Label>
          <input
            type="number"
            step="0.1"
            value={start.toFixed(1)}
            onChange={(e) =>
              onChange({ start: Math.max(0, Math.min(Number(e.target.value), end - 3)), end })
            }
            className="h-10 w-full rounded-xl border border-white/10 bg-ink-900/70 px-3 font-mono text-[12.5px] text-white focus:border-violet-400/50 focus:outline-none"
          />
        </div>
        <div>
          <Label hint="out">End</Label>
          <input
            type="number"
            step="0.1"
            value={end.toFixed(1)}
            onChange={(e) =>
              onChange({ start, end: Math.min(max, Math.max(Number(e.target.value), start + 3)) })
            }
            className="h-10 w-full rounded-xl border border-white/10 bg-ink-900/70 px-3 font-mono text-[12.5px] text-white focus:border-violet-400/50 focus:outline-none"
          />
        </div>
      </div>

      <Slider
        label="In point"
        min={0}
        max={max}
        step={0.1}
        value={start}
        onChange={(value) => onChange({ start: Math.min(value, end - 3), end })}
        format={formatTimecode}
      />
      <Slider
        label="Out point"
        min={0}
        max={max}
        step={0.1}
        value={end}
        onChange={(value) => onChange({ start, end: Math.max(value, start + 3) })}
        format={formatTimecode}
      />

      <div className="flex items-center gap-2">
        {[
          { label: "-1s", delta: -1 },
          { label: "-0.2s", delta: -0.2 },
          { label: "+0.2s", delta: 0.2 },
          { label: "+1s", delta: 1 },
        ].map((nudge) => (
          <button
            key={nudge.label}
            onClick={() => {
              const nextEnd = Math.min(max, end + nudge.delta);
              if (nextEnd - start >= 3) onChange({ start, end: nextEnd });
            }}
            className="flex-1 rounded-lg border border-white/10 bg-white/[0.03] py-1.5 text-[11.5px] text-white/55 transition hover:bg-white/8 hover:text-white"
          >
            {nudge.label}
          </button>
        ))}
      </div>

      <button
        onClick={() => onChange({ start: aiStart, end: aiEnd })}
        className="inline-flex items-center gap-1.5 text-[11.5px] text-violet-300 transition hover:text-violet-200"
      >
        <RotateCcw className="size-3" /> Reset to the AI&apos;s cut ({formatTimecode(aiStart)} –{" "}
        {formatTimecode(aiEnd)})
      </button>

      <p className="rounded-xl border border-white/8 bg-white/[0.02] p-2.5 text-[10.5px] leading-relaxed text-white/35">
        Keep the start before the first word and the end after the last one — Clipwave already added
        a small lead-in and tail so no sentence is cut.
      </p>
    </div>
  );
}

/* ------------------------------- Format ---------------------------------- */

export const MUSIC_TRACKS = [
  { id: "", name: "No music", note: "Original audio only" },
  { id: "ambient-dream", name: "Ambient Dream", note: "Soft pad · 90 BPM" },
  { id: "lofi-loop", name: "Lo-fi Loop", note: "Warm keys · 80 BPM" },
  { id: "hype-pulse", name: "Hype Pulse", note: "Driving pulse · energetic" },
];

export function FormatPanel({
  edits,
  update,
  planAllows60fps,
}: {
  edits: Record<string, unknown>;
  update: (patch: Record<string, unknown>) => void;
  planAllows60fps: boolean;
}) {
  return (
    <div className="space-y-4">
      <h3 className="inline-flex items-center gap-1.5 text-[12px] font-semibold text-white/80">
        <Crop className="size-3.5 text-electric-400" /> Format & effects
      </h3>

      <div>
        <Label>Aspect ratio</Label>
        <div className="grid grid-cols-3 gap-1.5">
          {[
            { Id: "9:16" as const, label: "9:16", note: "Shorts · Reels" },
            { Id: "16:9" as const, label: "16:9", note: "YouTube" },
            { Id: "1:1" as const, label: "1:1", note: "Feed" },
          ].map((option) => (
            <button
              key={option.Id}
              onClick={() => update({ aspect: option.Id })}
              className={cn(
                "rounded-xl border px-2 py-2 text-center transition",
                (edits.aspect ?? "9:16") === option.Id
                  ? "border-violet-400/50 bg-violet-500/15"
                  : "border-white/10 bg-white/[0.03] hover:border-white/20",
              )}
            >
              <span className="block text-[12.5px] font-semibold text-white">{option.label}</span>
              <span className="block text-[10px] text-white/40">{option.note}</span>
            </button>
          ))}
        </div>
      </div>

      <div>
        <Label>Reframing</Label>
        <Select
          value={typeof edits.cropMode === "string" ? edits.cropMode : "face"}
          onChange={(value) => update({ cropMode: value })}
          options={[
            { value: "face", label: "AI face tracking (pan to speaker)" },
            { value: "center", label: "Centre crop" },
            { value: "blur", label: "Blurred background fill" },
          ]}
        />
      </div>

      <Slider
        label="Playback speed"
        min={0.5}
        max={2}
        step={0.05}
        value={Number(edits.speed ?? 1)}
        onChange={(value) => update({ speed: value })}
        format={(value) => `${value.toFixed(2)}×`}
      />

      <div>
        <Label hint={planAllows60fps ? "Ultimate" : "Ultimate unlocks 60"}>Frame rate</Label>
        <div className="grid grid-cols-2 gap-1.5">
          {[30, 60].map((value) => {
            const locked = value === 60 && !planAllows60fps;
            const active = Number(edits.fps ?? 30) === value;
            return (
              <button
                key={value}
                onClick={() => !locked && update({ fps: value })}
                disabled={locked}
                title={locked ? "60 FPS is available on the Ultimate plan" : undefined}
                className={cn(
                  "relative rounded-xl border px-2 py-2.5 text-center text-[12px] transition",
                  active
                    ? "border-violet-400/50 bg-violet-500/15 text-white"
                    : "border-white/10 bg-white/[0.03] text-white/60 hover:border-white/20",
                  locked && "cursor-not-allowed opacity-45 hover:border-white/10",
                )}
              >
                {value} FPS
                {locked ? <Lock className="absolute right-1.5 top-1.5 size-3 text-white/40" /> : null}
              </button>
            );
          })}
        </div>
      </div>

      <div>
        <Label hint="built-in royalty-free">Background music</Label>
        <Select
          value={typeof edits.musicId === "string" ? edits.musicId : ""}
          onChange={(value) => update({ musicId: value })}
          options={MUSIC_TRACKS.map((track) => ({
            value: track.id,
            label: track.id ? `${track.name} — ${track.note}` : track.name,
          }))}
        />
        {typeof edits.musicId === "string" && edits.musicId ? (
          <div className="mt-2">
            <Slider
              label="Music volume"
              min={0.02}
              max={0.6}
              step={0.01}
              value={Number(edits.musicVolume ?? 0.18)}
              onChange={(value) => update({ musicVolume: value })}
              format={(value) => `${Math.round(value * 100)}%`}
            />
          </div>
        ) : null}
      </div>

      <div className="space-y-3 rounded-xl border border-white/8 bg-white/[0.02] p-3">
        <Switch
          checked={Boolean(edits.introEnabled)}
          onChange={(value) => update({ introEnabled: value })}
          label="Branded intro"
          description="1.2s title card before the clip"
        />
        {edits.introEnabled ? (
          <input
            value={typeof edits.introText === "string" ? edits.introText : "Clipwave"}
            onChange={(e) => update({ introText: e.target.value })}
            placeholder="Intro text"
            className="h-9 w-full rounded-lg border border-white/10 bg-ink-900/70 px-2.5 text-[12px] text-white focus:outline-none"
          />
        ) : null}
        <Switch
          checked={Boolean(edits.outroEnabled)}
          onChange={(value) => update({ outroEnabled: value })}
          label="Outro card"
          description="1.4s follow prompt at the end"
        />
        {edits.outroEnabled ? (
          <input
            value={typeof edits.outroText === "string" ? edits.outroText : "Follow for more"}
            onChange={(e) => update({ outroText: e.target.value })}
            placeholder="Outro text"
            className="h-9 w-full rounded-lg border border-white/10 bg-ink-900/70 px-2.5 text-[12px] text-white focus:outline-none"
          />
        ) : null}
      </div>

      <div className="flex items-center justify-between rounded-xl border border-white/8 bg-white/[0.02] p-3 text-[11px] text-white/40">
        <span className="inline-flex items-center gap-1.5">
          <Zap className="size-3.5 text-amber-400" /> Output
        </span>
        <span>
          {planAllows60fps ? "60 FPS available" : "30 FPS"} · watermarked{" "}
          {edits.watermarkDisabled ? "off" : "per plan"}
        </span>
      </div>
    </div>
  );
}

/* -------------------------------- Score ---------------------------------- */

export function ScorePanel({ clip }: { clip: ClipDto }) {
  const tone = scoreTone(clip.viralScore);
  const breakdown: Record<string, number> = clip.scoreBreakdown ?? {};
  const entries = Object.entries(breakdown);

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-4">
        <RingProgress value={clip.viralScore} size={78} stroke={6} color={tone.stroke} label={clip.viralScore} />
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wider text-white/40">
            Viral potential
          </p>
          <p className={cn("font-display text-lg font-semibold", tone.className)}>{tone.label}</p>
          <p className="mt-0.5 text-[11px] text-white/35">
            AI estimate — not a guarantee of views
          </p>
        </div>
      </div>

      <div className="space-y-2">
        {entries.map(([key, value]) => (
          <div key={key}>
            <div className="flex justify-between text-[11px]">
              <span className="capitalize text-white/50">{key.replace(/([A-Z])/g, " $1")}</span>
              <span className="font-mono text-white/40">{Math.round(value)}</span>
            </div>
            <div className="mt-0.5 h-1 overflow-hidden rounded-full bg-white/8">
              <div
                className="h-full rounded-full bg-gradient-to-r from-violet-500 to-cyan-400"
                style={{ width: `${Math.max(2, Math.min(100, value))}%` }}
              />
            </div>
          </div>
        ))}
      </div>

      <div className="rounded-xl border border-white/8 bg-white/[0.02] p-3">
        <p className="inline-flex items-center gap-1.5 text-[10.5px] font-semibold uppercase tracking-wider text-mint-400">
          <Sparkles className="size-3" /> Why this clip
        </p>
        <p className="mt-1 text-[11.5px] leading-relaxed text-white/55">{clip.reason}</p>
        <p className="mt-2 text-[10.5px] text-white/35">
          Best platform: <span className="text-white/60">{clip.bestPlatform}</span>
        </p>
      </div>

      {clip.improvements?.length ? (
        <div className="rounded-xl border border-amber-400/20 bg-amber-400/[0.05] p-3">
          <p className="text-[10.5px] font-semibold uppercase tracking-wider text-amber-300">
            Suggested improvements
          </p>
          <ul className="mt-1 space-y-1 text-[11.5px] leading-relaxed text-white/50">
            {clip.improvements.map((item: string) => (
              <li key={item}>· {item}</li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}

/* ------------------------------ Thumbnail -------------------------------- */

export function ThumbnailPanel({
  clip,
  onUpdated,
}: {
  clip: ClipDto;
  onUpdated: (clip: ClipDto) => void;
}) {
  const toast = useToast();
  const [text, setText] = useState<string>(clip.seo?.thumbnailText ?? "");
  const [frameTime, setFrameTime] = useState<number>(clip.startSec + clip.durationSec * 0.4);
  const [busy, setBusy] = useState(false);
  const [version, setVersion] = useState(0);
  const bgRef = useRef<HTMLInputElement>(null);
  const logoRef = useRef<HTMLInputElement>(null);

  const regenerate = async (withFiles = false) => {
    setBusy(true);
    try {
      const form = new FormData();
      if (text) form.append("text", text);
      if (Number.isFinite(frameTime)) form.append("frameTime", String(frameTime));
      if (withFiles) {
        const bg = bgRef.current?.files?.[0];
        const logo = logoRef.current?.files?.[0];
        if (bg) form.append("background", bg);
        if (logo) form.append("logo", logo);
      }
      const res = await fetch(`/api/clips/${clip.id}/thumbnail`, {
        method: "POST",
        credentials: "include",
        body: form,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error ?? "Thumbnail failed");
      onUpdated(data.clip);
      setVersion((v) => v + 1);
      toast.success("Thumbnail regenerated");
    } catch (err: unknown) {
      toast.error(errorMessage(err, "Could not build the thumbnail"));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-4">
      <h3 className="inline-flex items-center gap-1.5 text-[12px] font-semibold text-white/80">
        <ImageIcon className="size-3.5 text-amber-400" /> Thumbnail
      </h3>

      <div className="overflow-hidden rounded-2xl border border-white/10 bg-ink-950">
        {clip.thumbnailUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={`${clip.thumbnailUrl}?v=${version}`} alt="Clip thumbnail" className="w-full" />
        ) : (
          <div className="grid aspect-video place-items-center text-[12px] text-white/30">
            Not generated yet
          </div>
        )}
      </div>

      <div>
        <Label hint="max 4 words">Overlay text</Label>
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          className="h-10 w-full rounded-xl border border-white/10 bg-ink-900/70 px-3 text-[12.5px] text-white focus:border-violet-400/50 focus:outline-none"
          placeholder="WATCH THIS"
        />
      </div>

      <Slider
        label="Frame"
        min={clip.startSec}
        max={clip.endSec}
        step={0.1}
        value={frameTime}
        onChange={setFrameTime}
        format={formatTimecode}
      />

      <div className="grid grid-cols-2 gap-2">
        <button
          onClick={() => bgRef.current?.click()}
          className="flex items-center justify-center gap-1.5 rounded-xl border border-white/10 bg-white/[0.03] py-2 text-[11.5px] text-white/55 hover:text-white"
        >
          <Upload className="size-3.5" /> Background
        </button>
        <button
          onClick={() => logoRef.current?.click()}
          className="flex items-center justify-center gap-1.5 rounded-xl border border-white/10 bg-white/[0.03] py-2 text-[11.5px] text-white/55 hover:text-white"
        >
          <Plus className="size-3.5" /> Logo
        </button>
      </div>
      <input ref={bgRef} type="file" accept="image/*" className="hidden" />
      <input ref={logoRef} type="file" accept="image/*" className="hidden" />

      <div className="flex gap-2">
        <Button className="flex-1" loading={busy} onClick={() => regenerate(true)} icon={<Sparkles className="size-4" />}>
          Compose
        </Button>
        <Button variant="secondary" onClick={() => regenerate(false)} loading={busy}>
          Auto frame
        </Button>
      </div>

      {clip.thumbnailUrl ? (
        <a
          href={`/api/clips/${clip.id}/download?kind=thumb`}
          className="flex h-10 items-center justify-center gap-1.5 rounded-xl border border-white/10 bg-white/[0.03] text-[12px] text-white/65 hover:text-white"
        >
          <Download className="size-3.5" /> Download HD
        </a>
      ) : null}
    </div>
  );
}

/* -------------------------------- Export --------------------------------- */

export function ExportPanel({
  clip,
  maxResolution,
  planName,
}: {
  clip: ClipDto;
  maxResolution: number;
  planName: string;
}) {
  const [resolution, setResolution] = useState<number>(Math.min(1080, maxResolution));

  return (
    <div className="space-y-4">
      <h3 className="inline-flex items-center gap-1.5 text-[12px] font-semibold text-white/80">
        <FileVideo className="size-3.5 text-mint-400" /> Export
      </h3>

      <div>
        <Label hint={`${planName} plan max`}>Resolution</Label>
        <div className="grid grid-cols-2 gap-1.5">
          {[720, 1080].map((value) => {
            const locked = value > maxResolution;
            return (
              <button
                key={value}
                onClick={() => !locked && setResolution(value)}
                className={cn(
                  "rounded-xl border px-2 py-2.5 text-center transition",
                  resolution === value
                    ? "border-violet-400/50 bg-violet-500/15"
                    : "border-white/10 bg-white/[0.03]",
                  locked && "cursor-not-allowed opacity-45",
                )}
              >
                <span className="block text-[13px] font-semibold text-white">{value}p</span>
                <span className="block text-[10px] text-white/40">
                  {locked ? "Upgrade" : value === 1080 ? "Full HD" : "HD"}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="space-y-2">
        <a
          href={`/api/clips/${clip.id}/download?kind=video&resolution=${resolution}`}
          className={cn(
            "flex h-11 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-violet-500 to-electric-500 text-[13px] font-semibold text-white transition hover:brightness-110",
            clip.status !== "ready" && "pointer-events-none opacity-50",
          )}
        >
          <Download className="size-4" /> Download MP4 · {resolution}p
        </a>
        <a
          href={`/api/clips/${clip.id}/download?kind=srt`}
          className="flex h-10 items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/[0.03] text-[12.5px] text-white/65 transition hover:text-white"
        >
          <Download className="size-3.5" /> Download SRT subtitles
        </a>
        <a
          href={`/api/clips/${clip.id}/download?kind=thumb`}
          className="flex h-10 items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/[0.03] text-[12.5px] text-white/65 transition hover:text-white"
        >
          <ImageIcon className="size-3.5" /> Download thumbnail
        </a>
      </div>

      <div className="rounded-xl border border-white/8 bg-white/[0.02] p-3 text-[11px] leading-relaxed text-white/40">
        <p className="mb-1 font-semibold text-white/60">Platform targets</p>
        <p>9:16 → TikTok, Reels, Shorts · 16:9 → YouTube · 1:1 → feed posts</p>
        <p className="mt-1">
          MP4 (H.264 + AAC, faststart) is accepted by every platform without re-encoding.
        </p>
      </div>

      <p className="flex items-center gap-1.5 text-[10.5px] text-white/30">
        <Gauge className="size-3" /> Exports are logged in your export history.
      </p>
    </div>
  );
}
