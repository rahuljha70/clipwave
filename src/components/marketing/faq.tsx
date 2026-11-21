"use client";

import { AnimatePresence, motion } from "framer-motion";
import { Minus, Plus } from "lucide-react";
import { useState } from "react";
import { SectionHeading } from "@/components/ui/card";

const FAQS = [
  {
    q: "Is the whole video really analysed, or just a preview?",
    a: "The whole thing. The full audio track is transcribed with word-level timestamps and profiled for loudness, spectral flux and pitch movement. Moment detection then scores every candidate window across the transcript, so a funny beat at minute 78 is found just as reliably as one at minute 2.",
  },
  {
    q: "What happens with private, deleted or live videos?",
    a: "Public YouTube and Kick replays can be imported and clipped like regular videos. Active streams, scheduled broadcasts and replays that are not ready yet get a clear message. Private, members-only, age-restricted or deleted content is not accessed; for anything you own, use the upload option and the same clipping pipeline.",
  },
  {
    q: "Do you bypass DRM or platform protections?",
    a: "Never. There is no DRM circumvention, no paywall bypass and no access-control trickery anywhere in the codebase. Media is acquired from public sources through yt-dlp, and you can disable remote fetching entirely with ALLOW_REMOTE_FETCH=false to run a self-hosted, upload-only deployment.",
  },
  {
    q: "Which languages are supported for captions?",
    a: "Whisper handles 90+ languages; Clipwave ships fonts and layout tuning for English, Hindi and Nepali (Devanagari). Language is auto-detected, and you can override it per project.",
  },
  {
    q: "Are the viral scores a guarantee?",
    a: "No — they are an AI estimate built from hook strength, retention pacing, emotional intensity, humour cues and context completeness. Use them to sort and compare clips inside your own video, not as a promise of views.",
  },
  {
    q: "Can I edit after the AI has cut the clips?",
    a: "Yes. Every clip opens in the studio where you can drag the in/out points, change aspect ratio, swap caption style, adjust font, colour, outline and position, change playback speed, add music, an intro/outro and text overlays — then re-render just that clip.",
  },
  {
    q: "What files do I get?",
    a: "An MP4 per clip at 720p or 1080p (9:16, 16:9 or 1:1 — 60 FPS on Ultimate), the matching SRT subtitle file, and a JPEG thumbnail. Pro and Ultimate exports are watermark-free.",
  },
  {
    q: "Can I run it locally?",
    a: "Yes. The repo runs with SQLite out of the box, or point DATABASE_URL at Supabase/Postgres for production. FFmpeg, yt-dlp and Python (faster-whisper) are the only external dependencies — the README has the exact commands.",
  },
];

export function Faq() {
  const [open, setOpen] = useState<number | null>(0);
  return (
    <section id="faq" className="relative mx-auto w-full max-w-4xl px-5 py-20 sm:px-8 sm:py-24">
      <SectionHeading
        center
        eyebrow="FAQ"
        title="Questions, answered plainly"
        description="If something here isn't clear, the README documents every pipeline step and environment flag."
      />

      <div className="mt-10 divide-y divide-white/8 overflow-hidden rounded-3xl border border-white/8 bg-white/[0.02]">
        {FAQS.map((item, i) => {
          const isOpen = open === i;
          return (
            <div key={item.q}>
              <button
                onClick={() => setOpen(isOpen ? null : i)}
                className="flex w-full items-center justify-between gap-4 px-5 py-4.5 text-left transition hover:bg-white/[0.03] sm:px-6"
              >
                <span className="text-[13.5px] font-medium text-white/90 sm:text-sm">{item.q}</span>
                <span className="grid size-7 shrink-0 place-items-center rounded-full border border-white/10 bg-white/5 text-white/60">
                  {isOpen ? <Minus className="size-3.5" /> : <Plus className="size-3.5" />}
                </span>
              </button>
              <AnimatePresence initial={false}>
                {isOpen ? (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
                    className="overflow-hidden"
                  >
                    <p className="px-5 pb-5 text-[13px] leading-relaxed text-white/50 sm:px-6 sm:pr-16">
                      {item.a}
                    </p>
                  </motion.div>
                ) : null}
              </AnimatePresence>
            </div>
          );
        })}
      </div>
    </section>
  );
}
