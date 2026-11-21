"use client";

import {
  AlertCircle,
  ArrowRight,
  CheckCircle2,
  Clock,
  Film,
  Sparkles,
 StepForward,
  Upload,
  Wand2,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input, Label, Select, Slider, Switch } from "@/components/ui/field";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/components/ui/toast";
import { apiPost, uploadVideo } from "@/lib/client/api";
import { CLIP_LENGTHS, SUBTITLE_STYLES } from "@/lib/plans";
import { cn, formatBytes, formatDuration, platformFromUrl } from "@/lib/utils";

interface ResolvedSource {
  title: string;
  channel: string | null;
  thumbnailUrl: string | null;
  durationSec: number;
  platform: string;
  isLive: boolean;
}

export function CreateProjectForm({
  plan,
  allowedStyles,
  isAdmin = false,
}: {
  plan: string;
  allowedStyles: string[];
  isAdmin?: boolean;
}) {
  const router = useRouter();
  const toast = useToast();
  const fileRef = useRef<HTMLInputElement>(null);

  const [url, setUrl] = useState("");
  const [source, setSource] = useState<ResolvedSource | null>(null);
  const [resolving, setResolving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [mode, setMode] = useState<"url" | "upload">("url");
  const [file, setFile] = useState<File | null>(null);

  const [targetLength, setTargetLength] = useState(30);
  const [requestedClips, setRequestedClips] = useState(plan === "free" ? 5 : 8);
  const [aspect, setAspect] = useState("9:16");
  const [subtitleStyle, setSubtitleStyle] = useState(allowedStyles[0] ?? "minimal");
  const [faceTracking, setFaceTracking] = useState(true);

  useEffect(() => {
    try {
      const pending = localStorage.getItem("clipwave_pending_url");
      if (pending) {
        setUrl(pending);
        localStorage.removeItem("clipwave_pending_url");
      }
    } catch {}
  }, []);

  const resolve = async () => {
    if (!url.trim()) {
      setError("Paste a video link first.");
      return;
    }
    setResolving(true);
    setError(null);
    setSource(null);
    try {
      const res = await apiPost<{ source: ResolvedSource; entitlement: { allowed: boolean; reason: string | null } }>(
        "/api/sources/resolve",
        { url: url.trim() },
      );
      setSource(res.source);
      if (!res.entitlement.allowed && res.entitlement.reason) setError(res.entitlement.reason);
    } catch (err: any) {
      setError(err?.message ?? "We could not read that video.");
    } finally {
      setResolving(false);
    }
  };

  const create = async () => {
    setSubmitting(true);
    setError(null);
    try {
      if (mode === "upload") {
        if (!file) {
          setError("Choose a video file to upload.");
          setSubmitting(false);
          return;
        }
        const created = await uploadVideo(
          file,
          {
            title: file.name.replace(/\.[^.]+$/, ""),
            targetLength,
            requestedClips,
            aspect,
            subtitleStyle,
          },
          setUploadProgress,
        );
        toast.success("Upload complete", "Your video is queued for analysis.");
        router.push(`/dashboard/projects/${created.projectId}`);
      } else {
        const created = await apiPost<{ projectId: string; requestedClips: number }>("/api/projects", {
          url: url.trim(),
          targetLength,
          requestedClips,
          aspect,
          subtitleStyle,
        });
        toast.success("Import started", "Analysing the source — this page will update live.");
        router.push(`/dashboard/projects/${created.projectId}`);
      }
    } catch (err: any) {
      setError(err?.message ?? "Could not start this project.");
      setSubmitting(false);
    }
  };

  const platform = platformFromUrl(url);

  return (
    <div className="grid gap-5 lg:grid-cols-[1.25fr_1fr]">
      <div className="space-y-5">
        <div className="glass rounded-3xl p-5">
          <div className="mb-4 flex items-center gap-1 rounded-xl border border-white/10 bg-white/[0.03] p-1">
            {(
              [
                { id: "url", label: "Import from URL", icon: Film },
                { id: "upload", label: "Upload a file", icon: Upload },
              ] as const
            ).map((tab) => (
              <button
                key={tab.id}
                onClick={() => setMode(tab.id)}
                className={cn(
                  "flex flex-1 items-center justify-center gap-2 rounded-lg py-2 text-[12.5px] font-medium transition",
                  mode === tab.id
                    ? "bg-gradient-to-r from-violet-500/25 to-electric-500/15 text-white"
                    : "text-white/45 hover:text-white/80",
                )}
              >
                <tab.icon className="size-4" /> {tab.label}
              </button>
            ))}
          </div>

          {mode === "url" ? (
            <>
              <Label htmlFor="source-url" hint="YouTube · Kick · livestream replays">
                Video URL
              </Label>
              <div className="flex flex-col gap-2 sm:flex-row">
                <input
                  id="source-url"
                  value={url}
                  onChange={(e) => {
                    setUrl(e.target.value);
                    setSource(null);
                    setError(null);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") void resolve();
                  }}
                  placeholder="https://www.youtube.com/watch?v=…  or  https://kick.com/video/…"
                  className="h-11 w-full flex-1 rounded-xl border border-white/10 bg-ink-900/70 px-3.5 text-[13.5px] text-white placeholder:text-white/25 focus:border-violet-400/60 focus:outline-none focus:ring-2 focus:ring-violet-500/25"
                />
                <Button variant="secondary" onClick={resolve} loading={resolving} icon={<ArrowRight className="size-4" />}>
                  Check link
                </Button>
              </div>
              {platform !== "unknown" ? (
                <p className="mt-2 text-[11.5px] text-white/40">
                  Detected platform:{" "}
                  <span className="font-medium text-white/70">
                    {platform === "youtube" ? "YouTube" : "Kick"}
                  </span>
                </p>
              ) : null}

              {source ? (
                <div className="mt-4 flex items-center gap-3 rounded-2xl border border-mint-400/20 bg-mint-400/[0.06] p-3">
                  {source.thumbnailUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={source.thumbnailUrl}
                      alt=""
                      referrerPolicy="no-referrer"
                      className="h-16 w-28 shrink-0 rounded-lg object-cover"
                    />
                  ) : (
                    <div className="grid h-16 w-28 shrink-0 place-items-center rounded-lg bg-white/5">
                      <Film className="size-5 text-white/25" />
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[13px] font-medium text-white">{source.title}</p>
                    <p className="mt-0.5 flex flex-wrap items-center gap-2 text-[11.5px] text-white/45">
                      {source.channel ? <span className="truncate">{source.channel}</span> : null}
                      <span className="inline-flex items-center gap-1">
                        <Clock className="size-3" /> {formatDuration(source.durationSec)}
                      </span>
                      <span className="inline-flex items-center gap-1 text-mint-400">
                        <CheckCircle2 className="size-3" /> Public & available
                      </span>
                    </p>
                  </div>
                </div>
              ) : null}
            </>
          ) : (
            <>
              <Label hint="MP4 · MOV · WEBM · MKV up to 2 GB">Video file</Label>
              <button
                onClick={() => fileRef.current?.click()}
                className="flex w-full flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-white/15 bg-white/[0.02] px-4 py-8 transition hover:border-violet-400/40 hover:bg-violet-500/[0.06]"
              >
                <span className="grid size-11 place-items-center rounded-2xl border border-white/10 bg-white/5 text-violet-200">
                  <Upload className="size-5" />
                </span>
                {file ? (
                  <>
                    <span className="text-[13px] font-medium text-white">{file.name}</span>
                    <span className="text-[11.5px] text-white/45">{formatBytes(file.size)}</span>
                  </>
                ) : (
                  <>
                    <span className="text-[13px] font-medium text-white">Click to choose a video</span>
                    <span className="text-[11.5px] text-white/40">
                      Use this for anything you own — no download required
                    </span>
                  </>
                )}
              </button>
              <input
                ref={fileRef}
                type="file"
                accept="video/mp4,video/quicktime,video/webm,video/x-matroska"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) {
                    setFile(f);
                    setError(null);
                  }
                }}
              />
              {uploadProgress > 0 && uploadProgress < 100 ? (
                <div className="mt-3">
                  <div className="h-1.5 overflow-hidden rounded-full bg-white/10">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-violet-500 to-cyan-400 transition-all"
                      style={{ width: `${uploadProgress}%` }}
                    />
                  </div>
                  <p className="mt-1 text-[11px] text-white/40">Uploading — {uploadProgress}%</p>
                </div>
              ) : null}
            </>
          )}

          {error ? (
            <div className="mt-3 flex items-start gap-2 rounded-xl border border-rose-400/25 bg-rose-500/10 px-3.5 py-2.5 text-[12.5px] text-rose-200">
              <AlertCircle className="mt-0.5 size-4 shrink-0" /> <span>{error}</span>
            </div>
          ) : null}
        </div>

        <div className="glass rounded-3xl p-5">
          <p className="inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-white/40">
            <Wand2 className="size-3.5" /> Clip settings
          </p>

          <div className="mt-4 space-y-5">
            <div>
              <Label hint={`${targetLength}s per clip`}>Target clip length</Label>
              <div className="flex flex-wrap gap-1.5">
                {CLIP_LENGTHS.map((len) => (
                  <button
                    key={len}
                    onClick={() => setTargetLength(len)}
                    className={cn(
                      "rounded-xl border px-3.5 py-2 text-[12.5px] font-semibold transition",
                      targetLength === len
                        ? "border-violet-400/50 bg-violet-500/20 text-white"
                        : "border-white/10 bg-white/[0.03] text-white/50 hover:text-white",
                    )}
                  >
                    {len}s
                  </button>
                ))}
              </div>
            </div>

            {isAdmin ? (
              <div>
                <Label htmlFor="requested-clips" hint="No plan cap">
                  Clips to generate
                </Label>
                <Input
                  id="requested-clips"
                  type="number"
                  min={1}
                  max={2_147_483_647}
                  value={requestedClips}
                  onChange={(event) => setRequestedClips(Math.max(1, Number(event.target.value) || 1))}
                />
                <p className="mt-1.5 text-[11px] text-white/35">
                  The source length determines how many distinct clips can be found.
                </p>
              </div>
            ) : (
              <Slider
                label="Clips to generate"
                value={requestedClips}
                min={1}
                max={plan === "free" ? 5 : plan === "pro" ? 30 : 100}
                onChange={setRequestedClips}
                format={(v) => `${v} clips`}
              />
            )}

            <div>
              <Label>Output format</Label>
              <div className="grid grid-cols-3 gap-1.5">
                {[
                  { id: "9:16", label: "9:16", note: "Vertical" },
                  { id: "16:9", label: "16:9", note: "Landscape" },
                  { id: "1:1", label: "1:1", note: "Square" },
                ].map((option) => (
                  <button
                    key={option.id}
                    onClick={() => setAspect(option.id)}
                    className={cn(
                      "rounded-xl border px-2 py-2 text-center transition",
                      aspect === option.id
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
              <Label>Caption style</Label>
              <Select
                value={subtitleStyle}
                onChange={setSubtitleStyle}
                options={SUBTITLE_STYLES.map((style) => ({
                  value: style.id,
                  label: allowedStyles.includes(style.id)
                    ? style.name
                    : `${style.name} — Pro plan`,
                }))}
              />
              <p className="mt-1.5 text-[11px] text-white/35">
                {SUBTITLE_STYLES.find((s) => s.id === subtitleStyle)?.blurb}
              </p>
            </div>

            <Switch
              checked={faceTracking}
              onChange={setFaceTracking}
              label="AI face tracking"
              description="Pan the vertical crop toward the speaker instead of centring"
            />
          </div>
        </div>
      </div>

      <div className="space-y-5">
        <div className="glass sticky top-20 rounded-3xl p-5">
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-white/40">
            What happens next
          </p>
          <ol className="mt-3 space-y-3">
            {[
              "Source is validated and fetched (public media only)",
              "Whisper transcribes every word with timestamps",
              "Audio energy + semantics score each candidate moment",
              "FFmpeg cuts, reframes and burns animated captions",
              "Titles, descriptions, hashtags and thumbnails are written",
            ].map((step, i) => (
              <li key={step} className="flex gap-2.5">
                <span className="grid size-5 shrink-0 place-items-center rounded-full bg-white/8 text-[10.5px] font-bold text-white/60">
                  {i + 1}
                </span>
                <span className="text-[12px] leading-snug text-white/55">{step}</span>
              </li>
            ))}
          </ol>

          <div className="mt-4 rounded-xl border border-white/8 bg-white/[0.03] p-3 text-[11.5px] leading-relaxed text-white/45">
            <span className="font-semibold text-white/70">Processing minutes</span> are counted from
            the source duration, not the number of renders. Editing a clip afterwards is free.
          </div>

          <Button
            className="mt-4 w-full"
            size="lg"
            loading={submitting}
            onClick={create}
            icon={<Sparkles className="size-4" />}
          >
            {mode === "upload" ? "Upload & clip" : "Start clipping"}
          </Button>

          <div className="mt-3 flex items-center justify-center gap-1.5 text-[11px] text-white/30">
            <StepForward className="size-3" /> Typically 1–3× real time on CPU
          </div>

          {plan === "free" ? (
            <div className="mt-4 rounded-xl border border-violet-400/20 bg-violet-500/[0.08] p-3">
              <p className="text-[11.5px] font-medium text-violet-200">Free plan limits</p>
              <ul className="mt-1.5 space-y-1 text-[11px] text-white/45">
                <li>· 30 processing minutes / month</li>
                <li>· 5 clips per project · 720p export</li>
                <li>· Watermark on exports</li>
              </ul>
            </div>
          ) : (
            <div className="mt-4 flex items-center justify-center gap-1.5">
              <Badge tone="mint">{plan === "pro" ? "Pro" : "Ultimate"} · no watermark</Badge>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
