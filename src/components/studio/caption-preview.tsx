"use client";

import { useEffect, useMemo, useState } from "react";
import { cn } from "@/lib/utils";

export interface PreviewWord {
  start: number;
  end: number;
  word: string;
  speaker?: number;
}

export interface PreviewConfig {
  fontFamily: string;
  fontSize: number;
  textColor: string;
  highlightColor: string;
  outlineColor: string;
  outline: number;
  shadow: number;
  position: "top" | "middle" | "bottom";
  uppercase: boolean;
  maxWordsPerLine: number;
  highlightWords: boolean;
  animation: string;
  speakerLabels: boolean;
}

/**
 * Live caption preview driven by the clip's real word timings. It mirrors the
 * ASS renderer's chunking rules so what you see is what gets burned in.
 */
export function CaptionPreview({
  words,
  config,
  currentTime,
  accentFallback = "#5EF0C6",
}: {
  words: PreviewWord[];
  config: PreviewConfig;
  currentTime: number;
  accentFallback?: string;
}) {
  const chunks = useMemo(() => buildChunks(words, config.maxWordsPerLine), [words, config.maxWordsPerLine]);
  const activeIndex = useMemo(() => {
    const index = chunks.findIndex((c) => currentTime >= c.start - 0.05 && currentTime <= c.end);
    return index === -1 ? -1 : index;
  }, [chunks, currentTime]);

  if (!chunks.length) {
    return (
      <div className="rounded-2xl border border-dashed border-white/12 px-4 py-6 text-center text-[11.5px] text-white/35">
        No speech detected in this range — captions will be skipped.
      </div>
    );
  }

  const chunk = chunks[Math.max(0, activeIndex)];
  const positionClass =
    config.position === "top"
      ? "items-start pt-6"
      : config.position === "middle"
        ? "items-center"
        : "items-end pb-6";

  return (
    <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-[radial-gradient(circle_at_50%_20%,rgba(109,94,248,0.18),rgba(5,6,13,0.9))] p-3">
      <div className={cn("flex min-h-[128px] w-full justify-center", positionClass)}>
        <div
          className="flex flex-wrap items-center justify-center gap-x-[0.3em] gap-y-1 px-2 text-center"
          style={{
            fontFamily: `${config.fontFamily}, Inter, sans-serif`,
            fontSize: `${Math.max(11, config.fontSize * 320)}px`,
            fontWeight: 800,
            lineHeight: 1.1,
            letterSpacing: "-0.01em",
            color: config.textColor,
            textShadow: `0 0 ${config.shadow}px rgba(0,0,0,0.9), ${config.outline}px ${config.outline}px 0 ${config.outlineColor}, -${config.outline}px ${config.outline}px 0 ${config.outlineColor}, ${config.outline}px -${config.outline}px 0 ${config.outlineColor}, -${config.outline}px -${config.outline}px 0 ${config.outlineColor}`,
            WebkitTextStroke: config.outline > 4 ? `${Math.max(0, config.outline / 3)}px ${config.outlineColor}` : undefined,
          }}
        >
          {chunk.words.map((word, i) => {
            const isActive =
              config.highlightWords &&
              currentTime >= word.start - 0.02 &&
              currentTime <= word.end + 0.08;
            return (
              <span
                key={`${word.word}-${i}`}
                className="transition-all duration-150"
                style={{
                  color: isActive ? config.highlightColor || accentFallback : config.textColor,
                  transform: isActive && config.animation === "pop" ? "scale(1.1)" : "scale(1)",
                  display: "inline-block",
                }}
              >
                {config.uppercase ? word.word.toUpperCase() : word.word}
              </span>
            );
          })}
        </div>
      </div>

      <div className="mt-2 flex items-center justify-between text-[10px] text-white/30">
        <span>
          {config.maxWordsPerLine} words / line · {config.position}
        </span>
        <span className="font-mono">
          {activeIndex >= 0 ? `${chunk.start.toFixed(2)}s → ${chunk.end.toFixed(2)}s` : "—"}
        </span>
      </div>
    </div>
  );
}

function buildChunks(words: PreviewWord[], maxWordsPerLine: number) {
  const sorted = [...words].filter((w) => w.word?.trim()).sort((a, b) => a.start - b.start);
  const chunks: { start: number; end: number; words: PreviewWord[] }[] = [];
  let current: PreviewWord[] = [];
  const flush = () => {
    if (!current.length) return;
    chunks.push({
      start: current[0].start,
      end: current[current.length - 1].end + 0.12,
      words: current,
    });
    current = [];
  };
  for (const word of sorted) {
    if (!current.length) {
      current.push(word);
      continue;
    }
    const prev = current[current.length - 1];
    if (
      word.start - prev.end > 0.55 ||
      current.length >= maxWordsPerLine ||
      word.end - current[0].start > 3.2
    ) {
      flush();
      current.push(word);
    } else current.push(word);
  }
  flush();
  return chunks;
}

/** Tracks a video element's currentTime for caption sync. */
export function useVideoTime(videoRef: React.RefObject<HTMLVideoElement | null>) {
  const [time, setTime] = useState(0);
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    const onTime = () => setTime(video.currentTime);
    const onSeek = () => setTime(video.currentTime);
    video.addEventListener("timeupdate", onTime);
    video.addEventListener("seeked", onSeek);
    video.addEventListener("loadedmetadata", onSeek);
    return () => {
      video.removeEventListener("timeupdate", onTime);
      video.removeEventListener("seeked", onSeek);
      video.removeEventListener("loadedmetadata", onSeek);
    };
  }, [videoRef]);
  return time;
}
