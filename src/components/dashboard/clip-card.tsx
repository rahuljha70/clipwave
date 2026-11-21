"use client";

import { motion } from "framer-motion";
import { Bookmark, BookmarkCheck, Clock, Play, Sparkles } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { ScorePill } from "@/components/ui/badge";
import { StatusDot } from "@/components/ui/badge";
import { apiPatch } from "@/lib/client/api";
import { useToast } from "@/components/ui/toast";
import { cn, formatDuration } from "@/lib/utils";

export interface ClipDtoLite {
  id: string;
  projectId: string;
  title: string;
  category: string;
  viralScore: number;
  durationSec: number;
  status: string;
  progress?: number;
  thumbnailUrl: string | null;
  thumbnailPortraitUrl?: string | null;
  videoUrl: string | null;
  saved?: boolean;
  bestPlatform?: string;
  error?: string | null;
}

export function ClipCard({
  clip,
  index = 0,
  onToggleSave,
}: {
  clip: ClipDtoLite;
  index?: number;
  onToggleSave?: (saved: boolean) => void;
}) {
  const toast = useToast();
  const [saved, setSaved] = useState(Boolean(clip.saved));
  const [busy, setBusy] = useState(false);

  const toggleSave = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setBusy(true);
    const next = !saved;
    try {
      await apiPatch(`/api/clips/${clip.id}`, { saved: next });
      setSaved(next);
      onToggleSave?.(next);
      toast.success(next ? "Saved to library" : "Removed from library");
    } catch {
      toast.error("Could not update this clip");
    } finally {
      setBusy(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 18 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, delay: Math.min(0.4, index * 0.05) }}
      className="group relative"
    >
      <Link
        href={`/dashboard/clips/${clip.id}`}
        className="block overflow-hidden rounded-2xl border border-white/8 bg-ink-900/60 card-hover hover:-translate-y-0.5 hover:border-violet-400/35 hover:shadow-[0_24px_60px_-32px_rgba(109,94,248,0.7)]"
      >
        <div className="relative aspect-[9/16] overflow-hidden bg-ink-950">
          {clip.thumbnailPortraitUrl || clip.thumbnailUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={(clip.thumbnailPortraitUrl || clip.thumbnailUrl)!}
              alt=""
              onError={(e) => {
                // portrait twin is optional — fall back to the 16:9 cover
                const img = e.currentTarget;
                if (clip.thumbnailUrl && img.src !== clip.thumbnailUrl) img.src = clip.thumbnailUrl;
              }}
              className="size-full object-cover transition duration-500 group-hover:scale-[1.05]"
            />
          ) : (
            <div className="grid size-full place-items-center bg-[radial-gradient(circle_at_50%_35%,rgba(109,94,248,0.22),transparent_70%)]">
              {clip.status === "rendering" ? (
                <span className="text-[11px] text-white/50">Rendering…</span>
              ) : (
                <Sparkles className="size-6 text-white/20" />
              )}
            </div>
          )}

          <div className="absolute inset-0 bg-gradient-to-t from-ink-950 via-ink-950/10 to-transparent opacity-90" />

          <div className="absolute left-2 top-2">
            <ScorePill score={clip.viralScore} size="sm" />
          </div>
          <div className="absolute right-2 top-2 flex items-center gap-1">
            <button
              onClick={toggleSave}
              disabled={busy}
              aria-label={saved ? "Remove from saved" : "Save clip"}
              className={cn(
                "rounded-full border p-1.5 backdrop-blur transition",
                saved
                  ? "border-amber-400/40 bg-amber-400/25 text-amber-300"
                  : "border-white/15 bg-ink-950/60 text-white/60 hover:text-white",
              )}
            >
              {saved ? <BookmarkCheck className="size-3.5" /> : <Bookmark className="size-3.5" />}
            </button>
          </div>

          <div className="pointer-events-none absolute inset-0 grid place-items-center opacity-0 transition group-hover:opacity-100">
            <span className="grid size-11 place-items-center rounded-full bg-white/15 backdrop-blur-md">
              <Play className="size-4.5 fill-white text-white" />
            </span>
          </div>
        </div>

        {/* caption lives outside the artwork so it never fights the thumbnail headline */}
        <div className="border-t border-white/8 px-2.5 py-2.5">
          <p className="line-clamp-2 text-[11.5px] font-medium leading-snug text-white/90">
            {clip.title}
          </p>
          <div className="mt-1.5 flex items-center justify-between text-[10px] text-white/45">
            <span className="inline-flex items-center gap-1 capitalize">
              <StatusDot status={clip.status} /> {clip.status === "ready" ? clip.category : clip.status}
            </span>
            <span className="inline-flex items-center gap-1">
              {clip.bestPlatform ? <span className="truncate">{clip.bestPlatform}</span> : null}
              <Clock className="size-2.5" /> {formatDuration(clip.durationSec)}
            </span>
          </div>
        </div>
      </Link>
    </motion.div>
  );
}
