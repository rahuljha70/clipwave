"use client";

import { motion } from "framer-motion";
import { Captions, Clock, Flame, Gauge, Hash, Quote } from "lucide-react";
import { SectionHeading } from "@/components/ui/card";
import { ScorePill } from "@/components/ui/badge";

const HIGHLIGHTS = [
  { time: "00:42", label: "Uncontrollable laughter", score: 94, category: "Funny" },
  { time: "12:07", label: "The mic drop line", score: 88, category: "Quote" },
  { time: "26:31", label: "Chat goes wild", score: 81, category: "Reaction" },
];

export function DemoSection() {
  return (
    <section id="demo" className="relative mx-auto w-full max-w-7xl px-5 py-20 sm:px-8 sm:py-24">
      <div className="glass relative overflow-hidden rounded-[2rem] p-6 sm:p-10">
        <div className="pointer-events-none absolute -left-24 -top-24 size-72 rounded-full bg-violet-600/25 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-24 right-0 size-72 rounded-full bg-electric-500/20 blur-3xl" />

        <div className="relative grid items-center gap-10 lg:grid-cols-[0.9fr_1.1fr]">
          <div>
            <SectionHeading
              eyebrow="A real render"
              title="This is what comes out the other side"
              description="One 90-minute podcast produced 8 scored clips. Here is a single frame from the vertical export — captions burned in, reframed to the speaker, thumbnail composed."
            />

            <div className="mt-6 space-y-2.5">
              {HIGHLIGHTS.map((item, i) => (
                <motion.div
                  key={item.label}
                  initial={{ opacity: 0, x: -14 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: i * 0.1 }}
                  className="flex items-center gap-3 rounded-2xl border border-white/8 bg-white/[0.035] px-3.5 py-2.5"
                >
                  <span className="rounded-lg bg-ink-950/60 px-2 py-1 font-mono text-[11px] text-white/60">
                    {item.time}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[13px] font-medium text-white">{item.label}</p>
                    <p className="text-[11px] text-white/40">{item.category} moment</p>
                  </div>
                  <ScorePill score={item.score} size="sm" />
                </motion.div>
              ))}
            </div>

            <div className="mt-6 flex flex-wrap gap-2 text-[11.5px] text-white/45">
              <span className="inline-flex items-center gap-1.5 rounded-full border border-white/10 px-2.5 py-1">
                <Captions className="size-3.5" /> animated captions
              </span>
              <span className="inline-flex items-center gap-1.5 rounded-full border border-white/10 px-2.5 py-1">
                <Gauge className="size-3.5" /> face-tracked crop
              </span>
              <span className="inline-flex items-center gap-1.5 rounded-full border border-white/10 px-2.5 py-1">
                <Hash className="size-3.5" /> hashtags
              </span>
              <span className="inline-flex items-center gap-1.5 rounded-full border border-white/10 px-2.5 py-1">
                <Quote className="size-3.5" /> source credit
              </span>
            </div>
          </div>

          <div className="flex justify-center gap-4">
            <motion.div
              initial={{ opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.7 }}
              className="relative w-full max-w-[300px] overflow-hidden rounded-[1.6rem] border border-white/12 shadow-[0_40px_90px_-40px_rgba(0,0,0,0.9)]"
            >
              <video
                src="/demo/clip-demo.mp4"
                poster="/demo/clip-poster.jpg"
                autoPlay
                muted
                loop
                playsInline
                className="aspect-[9/16] w-full object-cover"
              />
              <div className="absolute left-2.5 top-2.5 inline-flex items-center gap-1 rounded-md bg-ink-950/70 px-1.5 py-0.5 text-[9.5px] font-bold uppercase tracking-wider text-white/80 backdrop-blur">
                <Clock className="size-2.5" /> 41s
              </div>
            </motion.div>

            <div className="hidden w-[210px] shrink-0 space-y-3 sm:block">
              <div className="glass rounded-2xl p-3.5">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-white/40">
                  Viral score
                </p>
                <p className="mt-1 flex items-baseline gap-1 font-display text-3xl font-bold text-mint-400">
                  94<span className="text-sm text-white/40">/100</span>
                </p>
                <div className="mt-2 space-y-1.5">
                  {[
                    ["Hook", 96],
                    ["Retention", 88],
                    ["Emotion", 91],
                  ].map(([label, value]) => (
                    <div key={label as string}>
                      <div className="flex justify-between text-[10.5px] text-white/45">
                        <span>{label}</span>
                        <span>{value}</span>
                      </div>
                      <div className="mt-0.5 h-1 overflow-hidden rounded-full bg-white/10">
                        <div
                          className="h-full rounded-full bg-gradient-to-r from-violet-500 to-cyan-400"
                          style={{ width: `${value}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="glass rounded-2xl p-3.5">
                <p className="inline-flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-amber-400">
                  <Flame className="size-3" /> Why it was picked
                </p>
                <p className="mt-1.5 text-[11.5px] leading-relaxed text-white/55">
                  Opens on a strong hook, laughter cues at 0:03, +11 dB energy spike, complete
                  thought start to finish.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
