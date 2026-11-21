"use client";

import { motion } from "framer-motion";
import {
  AudioLines,
  Crop,
  FileText,
  Gauge,
  Image as ImageIcon,
  Languages,
  Scissors,
  Sparkles,
  Wand2,
} from "lucide-react";
import { SectionHeading } from "@/components/ui/card";

const FEATURES = [
  {
    icon: Sparkles,
    title: "Moment detection that reads the room",
    body: "The engine scores every candidate window on hook strength, energy spikes, humour cues, pacing and context completeness — then keeps the winners.",
    accent: "from-violet-500/25",
  },
  {
    icon: AudioLines,
    title: "Word-level transcription",
    body: "Whisper timestamps every word, so clips never start mid-sentence and captions land on the exact beat of the audio.",
    accent: "from-electric-500/25",
  },
  {
    icon: Scissors,
    title: "Cuts that respect context",
    body: "Boundaries snap to sentence starts and ends with a small lead-in and tail, so the punchline always keeps its setup.",
    accent: "from-mint-400/25",
  },
  {
    icon: Crop,
    title: "Face-tracked 9:16 reframing",
    body: "OpenCV finds the speaker in sampled frames and FFmpeg pans the vertical crop smoothly — no more decapitated reaction shots.",
    accent: "from-cyan-400/25",
  },
  {
    icon: Wand2,
    title: "Six caption personalities",
    body: "MrBeast, gaming, podcast, minimal, bold viral and karaoke — with fonts, colours, outline, shadow and animation all customisable.",
    accent: "from-violet-500/25",
  },
  {
    icon: Languages,
    title: "Nepali, Hindi & English",
    body: "Whisper auto-detects the language and burns Devanagari-safe captions with the right fonts bundled.",
    accent: "from-amber-400/25",
  },
  {
    icon: FileText,
    title: "SEO written for you",
    body: "Eight title variations, a keyword-rich description with source credit, plus platform-specific hashtag sets and a one-click copy.",
    accent: "from-electric-500/25",
  },
  {
    icon: Gauge,
    title: "Honest viral scoring",
    body: "Every clip gets a 0–100 estimate with the reasoning, the sub-scores, and concrete suggestions. It's an estimate — never a promise.",
    accent: "from-mint-400/25",
  },
  {
    icon: ImageIcon,
    title: "Thumbnails that look designed",
    body: "Best-frame selection, gradient scrim, bold text and a score badge — export HD, or drop in your own frame and logo.",
    accent: "from-violet-500/25",
  },
];

export function Features() {
  return (
    <section id="features" className="relative mx-auto w-full max-w-7xl px-5 py-20 sm:px-8 sm:py-28">
      <SectionHeading
        center
        eyebrow="The engine"
        title={
          <>
            Everything between the link and the <span className="gradient-text">upload button</span>
          </>
        }
        description="Clipwave is not a wrapper around a chat box. Every step is real media processing you can inspect, retry and edit."
      />

      <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {FEATURES.map((feature, i) => (
          <motion.div
            key={feature.title}
            initial={{ opacity: 0, y: 22 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-60px" }}
            transition={{ duration: 0.55, delay: (i % 3) * 0.08 }}
            className="group glass relative overflow-hidden rounded-3xl p-5 card-hover hover:-translate-y-1 hover:border-violet-400/30 hover:shadow-[0_28px_70px_-40px_rgba(109,94,248,0.8)]"
          >
            <div
              className={`pointer-events-none absolute -right-10 -top-12 size-36 rounded-full bg-gradient-to-br ${feature.accent} to-transparent blur-2xl opacity-70 transition-opacity group-hover:opacity-100`}
            />
            <span className="relative inline-flex rounded-2xl border border-white/10 bg-white/6 p-2.5 text-violet-200">
              <feature.icon className="size-5" />
            </span>
            <h3 className="relative mt-4 font-display text-[15px] font-semibold leading-snug text-white">
              {feature.title}
            </h3>
            <p className="relative mt-2 text-[13px] leading-relaxed text-white/50">{feature.body}</p>
          </motion.div>
        ))}
      </div>
    </section>
  );
}
