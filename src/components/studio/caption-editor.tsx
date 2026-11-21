"use client";

import { Pencil, RotateCcw } from "lucide-react";
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { formatTimecode } from "@/lib/utils";
import type { PreviewWord } from "./caption-preview";

interface Chunk {
  start: number;
  end: number;
  words: PreviewWord[];
}

function chunkWords(words: PreviewWord[], maxWords = 6): Chunk[] {
  const sorted = [...words].sort((a, b) => a.start - b.start);
  const chunks: Chunk[] = [];
  let current: PreviewWord[] = [];
  const flush = () => {
    if (!current.length) return;
    chunks.push({
      start: current[0].start,
      end: current[current.length - 1].end,
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
    if (word.start - prev.end > 0.55 || current.length >= maxWords) {
      flush();
      current.push(word);
    } else current.push(word);
  }
  flush();
  return chunks;
}

/**
 * Edit the transcript before burning it in. Text is redistributed across the
 * original chunk timing so the caption stays in sync with the audio.
 */
export function CaptionEditor({
  words,
  onChange,
  originalWords,
  onSeek,
}: {
  words: PreviewWord[];
  onChange: (words: PreviewWord[]) => void;
  originalWords: PreviewWord[];
  onSeek?: (time: number) => void;
}) {
  const [editing, setEditing] = useState<number | null>(null);
  const [draft, setDraft] = useState("");
  const chunks = useMemo(() => chunkWords(words), [words]);
  const dirty = useMemo(
    () => JSON.stringify(words.map((w) => w.word)) !== JSON.stringify(originalWords.map((w) => w.word)),
    [words, originalWords],
  );

  const commit = (index: number) => {
    const chunk = chunks[index];
    const tokens = draft.trim().split(/\s+/).filter(Boolean);
    if (!tokens.length) {
      setEditing(null);
      return;
    }
    const span = Math.max(0.4, chunk.end - chunk.start);
    const step = span / tokens.length;
    const replaced: PreviewWord[] = tokens.map((token, i) => ({
      word: token,
      start: chunk.start + i * step,
      end: chunk.start + (i + 1) * step,
      speaker: chunk.words[0]?.speaker,
    }));

    const startIndex = words.findIndex((w) => w.start === chunk.words[0].start && w.word === chunk.words[0].word);
    const next = [...words];
    if (startIndex >= 0) next.splice(startIndex, chunk.words.length, ...replaced);
    else next.push(...replaced);
    onChange(next.sort((a, b) => a.start - b.start));
    setEditing(null);
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <h3 className="inline-flex items-center gap-1.5 text-[12px] font-semibold text-white/80">
          <Pencil className="size-3.5 text-electric-400" /> Subtitle text
        </h3>
        {dirty ? (
          <Button
            size="sm"
            variant="ghost"
            onClick={() => onChange(originalWords)}
            icon={<RotateCcw className="size-3" />}
          >
            Reset
          </Button>
        ) : null}
      </div>

      <div className="max-h-56 space-y-1 overflow-y-auto rounded-xl border border-white/8 bg-ink-950/40 p-2">
        {chunks.length === 0 ? (
          <p className="px-2 py-6 text-center text-[11.5px] text-white/30">
            No words in this range.
          </p>
        ) : null}
        {chunks.map((chunk, i) => (
          <div key={`${chunk.start}-${i}`} className="group flex items-start gap-2 rounded-lg px-1.5 py-1 hover:bg-white/[0.04]">
            <button
              onClick={() => onSeek?.(chunk.start)}
              className="shrink-0 rounded bg-white/6 px-1.5 py-0.5 font-mono text-[9.5px] text-white/45 hover:text-white"
            >
              {formatTimecode(chunk.start)}
            </button>
            {editing === i ? (
              <div className="flex flex-1 items-center gap-1.5">
                <input
                  autoFocus
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") commit(i);
                    if (e.key === "Escape") setEditing(null);
                  }}
                  className="h-7 flex-1 rounded-md border border-violet-400/40 bg-ink-900 px-2 text-[11.5px] text-white focus:outline-none"
                />
                <button
                  onClick={() => commit(i)}
                  className="rounded-md bg-violet-500/25 px-2 py-1 text-[10.5px] text-violet-100"
                >
                  Save
                </button>
              </div>
            ) : (
              <button
                onClick={() => {
                  setEditing(i);
                  setDraft(chunk.words.map((w) => w.word).join(" "));
                }}
                className="flex-1 text-left text-[11.5px] leading-snug text-white/60 hover:text-white"
              >
                {chunk.words.map((w) => w.word).join(" ")}
              </button>
            )}
          </div>
        ))}
      </div>
      <p className="text-[10.5px] text-white/30">
        Click a line to fix a transcription error. Timings stretch to fit the edited text.
      </p>
    </div>
  );
}
