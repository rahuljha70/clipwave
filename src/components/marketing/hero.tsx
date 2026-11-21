"use client";

import { motion, useReducedMotion } from "framer-motion";
import { Mic, Play, ShieldCheck, Sparkles, TrendingUp, Wand2 } from "lucide-react";
import { UrlImport } from "./url-import";

const HEADLINE = ["Turn", "long", "videos", "into", "viral", "shorts", "with", "AI."];

export function Hero({ authed }: { authed: boolean }) {
  const reduce = useReducedMotion();

  return (
    <section className="relative overflow-hidden pt-28 pb-16 sm:pt-36 sm:pb-24">
      {/* aurora background */}
      <div className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
        <div className="animate-aurora absolute -left-40 top-[-10%] size-[42rem] rounded-full bg-violet-600/22 blur-[120px]" />
        <div
          className="animate-aurora absolute right-[-15%] top-[6%] size-[38rem] rounded-full bg-electric-500/18 blur-[130px]"
          style={{ animationDelay: "-6s" }}
        />
        <div className="absolute left-1/3 top-[38%] size-[26rem] rounded-full bg-cyan-400/10 blur-[110px]" />
        <div className="absolute inset-0 grid-lines opacity-[0.55] [mask-image:radial-gradient(ellipse_at_center,black,transparent_72%)]" />
      </div>

      <div className="mx-auto grid w-full max-w-7xl items-center gap-12 px-5 sm:px-8 lg:grid-cols-[1.08fr_0.92fr] lg:gap-8">
        <div>
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="glass inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-[12px] text-white/70"
          >
            <span className="relative flex size-2">
              <span className="absolute inline-flex size-full animate-ping rounded-full bg-mint-400 opacity-70" />
              <span className="relative inline-flex size-2 rounded-full bg-mint-400" />
            </span>
            Built on Whisper + FFmpeg + face tracking
            <span className="mx-1 h-3 w-px bg-white/15" />
            <span className="text-mint-300">processes real video</span>
          </motion.div>

          <h1 className="mt-5 font-display text-[2.6rem] font-extrabold leading-[1.03] tracking-[-0.03em] text-white sm:text-6xl lg:text-[4.15rem]">
            {HEADLINE.map((word, i) => (
              <motion.span
                key={`${word}-${i}`}
                initial={reduce ? { opacity: 1 } : { opacity: 0, y: 26, filter: "blur(10px)" }}
                animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
                transition={{ delay: 0.05 + i * 0.075, duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
                className={
                  i >= 4 && i <= 5
                    ? "gradient-text mr-[0.24em] inline-block"
                    : "mr-[0.24em] inline-block"
                }
              >
                {word}
              </motion.span>
            ))}
          </h1>

          <motion.p
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.55, duration: 0.7 }}
            className="mt-5 max-w-xl text-[15.5px] leading-relaxed text-white/60 sm:text-base"
          >
            Paste a YouTube or Kick link. Clipwave watches the whole stream, finds the moments that
            actually hold attention, cuts them into vertical clips with animated captions, and writes
            the titles, descriptions and hashtags — in one pass.
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.7, duration: 0.7 }}
            className="mt-8"
          >
            <UrlImport authed={authed} />
          </motion.div>

          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 1, duration: 0.8 }}
            className="mt-8 flex flex-wrap items-center gap-x-7 gap-y-3 text-[12.5px] text-white/40"
          >
            <span className="inline-flex items-center gap-1.5">
              <Mic className="size-3.5 text-mint-400" /> Whisper transcription · FFmpeg rendering
            </span>
            <span className="inline-flex items-center gap-1.5">
              <ShieldCheck className="size-3.5 text-electric-400" /> Public &amp; authorized sources only
            </span>
            <span className="inline-flex items-center gap-1.5">
              <Sparkles className="size-3.5 text-violet-300" /> No credit card for the free plan
            </span>
          </motion.div>
        </div>

        <PhoneDemo />
      </div>
    </section>
  );
}

function PhoneDemo() {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.94, y: 30 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      transition={{ delay: 0.35, duration: 0.9, ease: [0.22, 1, 0.36, 1] }}
      className="relative mx-auto w-full max-w-[360px] lg:max-w-[400px]"
    >
      <div className="absolute -inset-8 -z-10 rounded-full bg-gradient-to-tr from-violet-600/25 via-electric-500/15 to-cyan-400/20 blur-3xl" />

      <div className="relative rounded-[2.4rem] border border-white/12 bg-ink-900/80 p-2.5 shadow-[0_50px_120px_-40px_rgba(0,0,0,0.9)] backdrop-blur">
        <div className="relative overflow-hidden rounded-[1.9rem] bg-black">
          <video
            src="/demo/clip-demo.mp4"
            poster="/demo/clip-poster.jpg"
            autoPlay
            muted
            loop
            playsInline
            className="aspect-[9/16] w-full object-cover"
          />
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-ink-950 via-ink-950/85 to-ink-950/25" />

          <div className="absolute inset-x-0 top-0 flex items-center justify-between p-3.5">
            <span className="rounded-full border border-white/20 bg-black/45 px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.14em] text-white/85 backdrop-blur">
              Real render · 9:16 captioned
            </span>
            <span className="inline-flex items-center gap-1 rounded-full bg-mint-400 px-2.5 py-1 text-[10.5px] font-bold text-ink-950">
              <TrendingUp className="size-3" /> 94
            </span>
          </div>

          <div className="absolute inset-x-3.5 bottom-3.5">
            <div className="glass-strong rounded-2xl p-3">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-violet-300">
                AI title
              </p>
              <p className="mt-1 text-[13px] font-medium leading-snug text-white">
                &ldquo;He laughs for 4 seconds straight — then drops the best line of the stream&rdquo;
              </p>
              <div className="mt-2 flex items-center gap-1.5 text-[10.5px] text-white/45">
                <span className="rounded-md bg-white/8 px-1.5 py-0.5">#podcastclips</span>
                <span className="rounded-md bg-white/8 px-1.5 py-0.5">#funny</span>
                <span className="rounded-md bg-white/8 px-1.5 py-0.5">#fyp</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <motion.div
        animate={{ y: [0, -12, 0] }}
        transition={{ duration: 6, repeat: Infinity, ease: "easeInOut" }}
        className="glass-strong absolute -left-6 top-[26%] hidden rounded-2xl px-3.5 py-2.5 shadow-xl sm:block"
      >
        <p className="text-[10px] font-semibold uppercase tracking-wider text-mint-400">Detected</p>
        <p className="mt-0.5 text-[12.5px] font-medium text-white">Funny moment · 0:42</p>
      </motion.div>

      <motion.div
        animate={{ y: [0, 10, 0] }}
        transition={{ duration: 7, repeat: Infinity, ease: "easeInOut", delay: 1.2 }}
        className="glass-strong absolute -right-5 bottom-[22%] hidden rounded-2xl px-3.5 py-2.5 shadow-xl sm:block"
      >
        <p className="text-[10px] font-semibold uppercase tracking-wider text-electric-400">
          Auto reframe
        </p>
        <p className="mt-0.5 inline-flex items-center gap-1.5 text-[12.5px] font-medium text-white">
          <Wand2 className="size-3.5" /> Face tracked
        </p>
      </motion.div>

      <motion.div
        animate={{ y: [0, -8, 0] }}
        transition={{ duration: 5.5, repeat: Infinity, ease: "easeInOut", delay: 0.6 }}
        className="glass-strong absolute -right-3 top-[13%] hidden rounded-2xl px-3 py-2 shadow-xl sm:block"
      >
        <p className="inline-flex items-center gap-1.5 text-[11.5px] font-medium text-white">
          <Play className="size-3 fill-white" /> 8 clips found
        </p>
      </motion.div>
    </motion.div>
  );
}
