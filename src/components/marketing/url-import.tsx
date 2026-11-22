"use client";

import { motion } from "framer-motion";
import {
  AlertCircle,
  ArrowRight,
  CheckCircle2,
  Clock,
  Link2,
  Loader2,
  Sparkles,
  Upload,
  Zap,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { apiPost, uploadVideo } from "@/lib/client/api";
import { cn, errorMessage, formatDuration, platformFromUrl } from "@/lib/utils";

interface SourceMeta {
  title: string;
  channel: string | null;
  thumbnailUrl: string | null;
  durationSec: number;
  platform: string;
}

export function UrlImport({
  authed,
  compact,
  defaultLength = 30,
  onCreated,
}: {
  authed: boolean;
  compact?: boolean;
  defaultLength?: number;
  onCreated?: (projectId: string) => void;
}) {
  const router = useRouter();
  const toast = useToast();
  const [url, setUrl] = useState("");
  const [busy, setBusy] = useState(false);
  const [preview, setPreview] = useState<SourceMeta | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [targetLength, setTargetLength] = useState(defaultLength);
  const [uploading, setUploading] = useState(0);
  const fileRef = useRef<HTMLInputElement>(null);
  const platform = platformFromUrl(url);

  const startClip = async () => {
    setError(null);
    if (!url.trim()) {
      setError("Paste a YouTube or Kick link first.");
      return;
    }
    if (!authed) {
      try {
        localStorage.setItem("clipwave_pending_url", url.trim());
      } catch {}
      router.push("/register?next=/dashboard/new");
      return;
    }
    setBusy(true);
    try {
      const created = await apiPost<{ projectId: string }>("/api/projects", {
        url: url.trim(),
        targetLength,
        requestedClips: 8,
        aspect: "9:16",
        subtitleStyle: "mrbeast",
      });
      toast.success("Import started", "Clipwave is fetching the source and finding clips.");
      if (onCreated) onCreated(created.projectId);
      else router.push(`/dashboard/projects/${created.projectId}`);
    } catch (err: unknown) {
      setError(errorMessage(err, "We could not import that video."));
    } finally {
      setBusy(false);
    }
  };

  const checkSource = async () => {
    if (!url.trim()) return;
    setBusy(true);
    setError(null);
    setPreview(null);
    try {
      const res = await apiPost<{ source: SourceMeta; entitlement: { allowed: boolean; reason: string | null } }>(
        "/api/sources/resolve",
        { url: url.trim() },
      );
      setPreview(res.source);
      if (!res.entitlement.allowed && res.entitlement.reason) {
        setError(res.entitlement.reason);
      }
    } catch (err: unknown) {
      if (typeof err === "object" && err !== null && "status" in err && err.status === 401) {
        setPreview(null);
        setError(null);
      } else {
        setError(errorMessage(err, "We could not read that video."));
      }
    } finally {
      setBusy(false);
    }
  };

  const handleUpload = async (file: File) => {
    if (!authed) {
      router.push("/register?next=/dashboard/new");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const created = await uploadVideo(
        file,
        { title: file.name.replace(/\.[^.]+$/, ""), targetLength, requestedClips: 8, aspect: "9:16", subtitleStyle: "mrbeast" },
        (percent) => setUploading(percent),
      );
      toast.success("Upload complete", "Processing has started.");
      if (onCreated) onCreated(created.projectId);
      else router.push(`/dashboard/projects/${created.projectId}`);
    } catch (err: unknown) {
      setError(errorMessage(err, "Upload failed."));
    } finally {
      setBusy(false);
      setUploading(0);
    }
  };

  return (
    <div className={cn("w-full", compact ? "" : "max-w-2xl")}>
      <div className="glass relative overflow-hidden rounded-3xl p-2 shadow-[0_30px_80px_-40px_rgba(109,94,248,0.7)]">
        <div className="pointer-events-none absolute inset-x-10 -top-24 h-40 bg-violet-500/20 blur-3xl" />
        <div className="relative flex flex-col gap-2 sm:flex-row sm:items-center">
          <div className="flex flex-1 items-center gap-2.5 px-3">
            <span className="text-white/35">
              {platform === "youtube" ? (
                <YouTubeGlyph className="size-5 text-rose-400" />
              ) : platform === "kick" ? (
                <KickGlyph />
              ) : (
                <Link2 className="size-4.5" />
              )}
            </span>
            <input
              value={url}
              onChange={(e) => {
                setUrl(e.target.value);
                setPreview(null);
                setError(null);
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter") void startClip();
              }}
              onBlur={() => {
                if (url.trim() && !preview && authed) void checkSource();
              }}
              placeholder="Paste a YouTube or Kick video link…"
              spellCheck={false}
              className="h-12 w-full min-w-0 bg-transparent text-[14.5px] text-white placeholder:text-white/35 focus:outline-none"
              aria-label="Video URL"
            />
          </div>
          <div className="flex items-center gap-2">
            <div className="hidden items-center gap-1 rounded-xl border border-white/8 bg-white/[0.04] p-0.5 sm:flex">
              {[15, 30, 60, 90].map((len) => (
                <button
                  key={len}
                  onClick={() => setTargetLength(len)}
                  className={cn(
                    "rounded-lg px-2.5 py-1.5 text-[11.5px] font-semibold transition",
                    targetLength === len
                      ? "bg-violet-500/25 text-white"
                      : "text-white/45 hover:text-white/80",
                  )}
                >
                  {len}s
                </button>
              ))}
            </div>
            <Button onClick={startClip} loading={busy} className="h-12 px-5" icon={<Sparkles className="size-4" />}>
              Start clipping
            </Button>
          </div>
        </div>

        {busy && uploading > 0 ? (
          <div className="px-4 pb-3">
            <div className="h-1.5 overflow-hidden rounded-full bg-white/10">
              <motion.div
                className="h-full rounded-full bg-gradient-to-r from-violet-500 to-cyan-400"
                animate={{ width: `${uploading}%` }}
              />
            </div>
            <p className="mt-1.5 text-[11px] text-white/45">Uploading your file — {uploading}%</p>
          </div>
        ) : null}
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 px-1 text-[12px] text-white/40">
        <span className="inline-flex items-center gap-1.5">
          <YouTubeGlyph className="size-3.5 text-rose-400/80" /> YouTube videos & VODs
        </span>
        <span className="inline-flex items-center gap-1.5">
          <KickGlyph className="size-3.5 text-mint-400/80" /> Kick livestreams
        </span>
        <button
          onClick={() => fileRef.current?.click()}
          className="inline-flex items-center gap-1.5 text-white/55 transition hover:text-white"
        >
          <Upload className="size-3.5" /> or upload your own file
        </button>
        <input
          ref={fileRef}
          type="file"
          accept="video/mp4,video/quicktime,video/webm,video/x-matroska"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) void handleUpload(file);
          }}
        />
        <span className="ml-auto hidden items-center gap-1.5 sm:inline-flex">
          <Zap className="size-3.5 text-amber-400/80" /> Public & authorized sources only
        </span>
      </div>

      {error ? (
        <motion.div
          initial={{ opacity: 0, y: -6 }}
          animate={{ opacity: 1, y: 0 }}
          className="mt-3 flex items-start gap-2 rounded-xl border border-rose-400/25 bg-rose-500/10 px-3.5 py-2.5 text-[12.5px] text-rose-200"
        >
          <AlertCircle className="mt-0.5 size-4 shrink-0" />
          <span>{error}</span>
        </motion.div>
      ) : null}

      {preview ? (
        <motion.div
          initial={{ opacity: 0, y: -6 }}
          animate={{ opacity: 1, y: 0 }}
          className="glass mt-3 flex items-center gap-3 rounded-2xl p-3"
        >
          {preview.thumbnailUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={preview.thumbnailUrl}
              alt=""
              className="h-14 w-24 shrink-0 rounded-lg object-cover"
              referrerPolicy="no-referrer"
            />
          ) : (
            <div className="grid h-14 w-24 shrink-0 place-items-center rounded-lg bg-white/5">
              <Link2 className="size-5 text-white/30" />
            </div>
          )}
          <div className="min-w-0 flex-1">
            <p className="truncate text-[13px] font-medium text-white">{preview.title}</p>
            <p className="mt-0.5 flex items-center gap-2 text-[11.5px] text-white/45">
              {preview.channel ? <span className="truncate">{preview.channel}</span> : null}
              <span className="inline-flex items-center gap-1">
                <Clock className="size-3" /> {formatDuration(preview.durationSec)}
              </span>
              <span className="inline-flex items-center gap-1 text-mint-400">
                <CheckCircle2 className="size-3" /> Ready to import
              </span>
            </p>
          </div>
          <ArrowRight className="size-4 shrink-0 text-white/30" />
        </motion.div>
      ) : null}
    </div>
  );
}

export function YouTubeGlyph({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={cn("size-5", className)} fill="currentColor" aria-hidden>
      <path d="M21.6 7.2c-.23-.86-.9-1.54-1.76-1.77C18.25 5 12 5 12 5s-6.25 0-7.84.43c-.86.23-1.53.91-1.76 1.77C2 8.8 2 12 2 12s0 3.2.4 4.8c.23.86.9 1.54 1.76 1.77C5.75 19 12 19 12 19s6.25 0 7.84-.43c.86-.23 1.53-.91 1.76-1.77.4-1.6.4-4.8.4-4.8s0-3.2-.4-4.8M10 15.5v-7l6 3.5z" />
    </svg>
  );
}

export function KickGlyph({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={cn("size-5", className)} fill="currentColor" aria-hidden>
      <path d="M4 3h5v6.2L14.4 3H20l-6.6 8L20.4 21h-5.9L9 13.4V21H4z" />
    </svg>
  );
}

export function ImportBusyLabel() {
  return (
    <span className="inline-flex items-center gap-2 text-xs text-white/50">
      <Loader2 className="size-3.5 animate-spin" /> Checking source…
    </span>
  );
}
