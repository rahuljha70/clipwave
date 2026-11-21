"use client";

import { motion } from "framer-motion";
import { Download, Link2, Sparkles, Type, Wand2 } from "lucide-react";
import { SectionHeading } from "@/components/ui/card";

const STEPS = [
  {
    icon: Link2,
    title: "Paste the link",
    body: "YouTube video, livestream replay or Kick VOD. We validate it, read the metadata and check it's public.",
    tag: "~2 seconds",
  },
  {
    icon: Sparkles,
    title: "The AI watches it",
    body: "Audio is transcribed word by word, energy and pitch are profiled, and candidate moments are scored against each other.",
    tag: "Real Whisper + DSP",
  },
  {
    icon: Type,
    title: "Clips get built",
    body: "FFmpeg cuts, reframes to 9:16 with face tracking, burns animated captions and composes a thumbnail — per clip.",
    tag: "FFmpeg render",
  },
  {
    icon: Download,
    title: "Edit & export",
    body: "Adjust trim, captions, music and format in the studio, then export 1080p MP4 plus an SRT for each platform.",
    tag: "MP4 · SRT",
  },
];

export function HowItWorks() {
  return (
    <section id="how-it-works" className="relative py-20 sm:py-24">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/10 to-transparent" />
      <div className="mx-auto w-full max-w-7xl px-5 sm:px-8">
        <SectionHeading
          eyebrow="How it works"
          title="Four steps. One pass. No timeline scrubbing."
          description="The same pipeline runs for every project — nothing is pre-rendered or faked."
        />

        <div className="relative mt-12">
          <div className="absolute left-0 right-0 top-[38px] hidden h-px bg-gradient-to-r from-transparent via-violet-400/30 to-transparent lg:block" />
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {STEPS.map((step, i) => (
              <motion.div
                key={step.title}
                initial={{ opacity: 0, y: 24 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-80px" }}
                transition={{ duration: 0.55, delay: i * 0.1 }}
                className="relative"
              >
                <div className="relative z-10 mb-5 inline-flex size-[76px] items-center justify-center rounded-3xl border border-white/10 bg-ink-900/90 backdrop-blur">
                  <span className="absolute inset-0 rounded-3xl bg-gradient-to-br from-violet-500/20 to-transparent" />
                  <step.icon className="relative size-6 text-violet-200" />
                  <span className="absolute -right-1 -top-1 grid size-6 place-items-center rounded-full bg-gradient-to-br from-violet-500 to-electric-500 text-[11px] font-bold text-white">
                    {i + 1}
                  </span>
                </div>
                <h3 className="font-display text-base font-semibold text-white">{step.title}</h3>
                <p className="mt-1.5 text-[13px] leading-relaxed text-white/50">{step.body}</p>
                <span className="mt-3 inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-[10.5px] font-medium uppercase tracking-wider text-white/45">
                  <Wand2 className="size-3" />
                  {step.tag}
                </span>
              </motion.div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
