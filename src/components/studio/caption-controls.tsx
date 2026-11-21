"use client";

import { Captions, Palette, Type } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Label, Select, Slider, Switch } from "@/components/ui/field";
import { cn } from "@/lib/utils";

export const CAPTION_PRESETS = [
  { id: "mrbeast", name: "MrBeast", note: "Huge pop, heavy outline" },
  { id: "gaming", name: "Gaming", note: "Neon purple, chunky caps" },
  { id: "podcast", name: "Podcast", note: "Clean 2-line, readable" },
  { id: "minimal", name: "Minimal", note: "Small + elegant" },
  { id: "bold", name: "Bold viral", note: "Stacked, mid-screen" },
  { id: "karaoke", name: "Karaoke", note: "Word-by-word fill" },
];

const FONTS = [
  { value: "Inter", label: "Inter (default)" },
  { value: "Poppins", label: "Poppins" },
  { value: "Anton", label: "Anton (condensed)" },
  { value: "DejaVu Sans", label: "DejaVu Sans" },
  { value: "Noto Sans Devanagari", label: "Noto Devanagari (हिन्दी/नेपाली)" },
];

export interface CaptionDraft {
  style: string;
  fontFamily: string;
  fontSize: number;
  textColor: string;
  highlightColor: string;
  outlineColor: string;
  outline: number;
  shadow: number;
  position: "top" | "middle" | "bottom";
  uppercase: boolean;
  emoji: boolean;
  maxWordsPerLine: number;
  animation: "pop" | "fade" | "slide" | "none";
  highlightWords: boolean;
  speakerLabels: boolean;
}

export function CaptionControls({
  draft,
  update,
  allowedStyles,
  planName,
}: {
  draft: CaptionDraft;
  update: (patch: Partial<CaptionDraft>) => void;
  allowedStyles: string[];
  planName: string;
}) {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="inline-flex items-center gap-1.5 text-[12px] font-semibold text-white/80">
          <Captions className="size-3.5 text-violet-300" /> Caption style
        </h3>
        <Badge tone="neutral">{planName}</Badge>
      </div>

      <div className="grid grid-cols-2 gap-1.5">
        {CAPTION_PRESETS.map((preset) => {
          const locked = !allowedStyles.includes(preset.id);
          return (
            <button
              key={preset.id}
              disabled={locked}
              onClick={() => update({ style: preset.id })}
              className={cn(
                "rounded-xl border px-2.5 py-2 text-left transition",
                draft.style === preset.id
                  ? "border-violet-400/50 bg-violet-500/15"
                  : "border-white/10 bg-white/[0.03] hover:border-white/20",
                locked && "cursor-not-allowed opacity-40",
              )}
            >
              <span className="block text-[12px] font-semibold text-white">{preset.name}</span>
              <span className="block text-[10px] leading-tight text-white/40">
                {locked ? (preset.id === "gaming" ? "Ultimate plan" : "Pro plan") : preset.note}
              </span>
            </button>
          );
        })}
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div>
          <Label>Font</Label>
          <Select
            value={draft.fontFamily}
            onChange={(value) => update({ fontFamily: value })}
            options={FONTS}
          />
        </div>
        <div>
          <Label>Position</Label>
          <Select
            value={draft.position}
            onChange={(value) => update({ position: value as CaptionDraft["position"] })}
            options={[
              { value: "top", label: "Top" },
              { value: "middle", label: "Middle" },
              { value: "bottom", label: "Bottom" },
            ]}
          />
        </div>
      </div>

      <Slider
        label="Font size"
        min={0.025}
        max={0.1}
        step={0.002}
        value={draft.fontSize}
        onChange={(value) => update({ fontSize: value })}
        format={(value) => `${Math.round(value * 100)}% of height`}
      />

      <Slider
        label="Words per line"
        min={1}
        max={10}
        value={draft.maxWordsPerLine}
        onChange={(value) => update({ maxWordsPerLine: value })}
      />

      <div className="grid grid-cols-3 gap-2">
        {(
          [
            ["textColor", "Text"],
            ["highlightColor", "Highlight"],
            ["outlineColor", "Outline"],
          ] as const
        ).map(([key, label]) => (
          <div key={key}>
            <Label>{label}</Label>
            <div className="relative">
              <input
                type="color"
                value={draft[key]}
                onChange={(e) => update({ [key]: e.target.value } as Partial<CaptionDraft>)}
                className="h-9 w-full cursor-pointer rounded-lg border border-white/10 bg-transparent p-0.5"
              />
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-2">
        <Slider
          label="Outline"
          min={0}
          max={12}
          step={0.5}
          value={draft.outline}
          onChange={(value) => update({ outline: value })}
          format={(value) => `${value}px`}
        />
        <Slider
          label="Shadow"
          min={0}
          max={10}
          step={0.5}
          value={draft.shadow}
          onChange={(value) => update({ shadow: value })}
          format={(value) => `${value}px`}
        />
      </div>

      <div>
        <Label>Animation</Label>
        <Select
          value={draft.animation}
          onChange={(value) => update({ animation: value as CaptionDraft["animation"] })}
          options={[
            { value: "pop", label: "Pop in (scale)" },
            { value: "fade", label: "Fade" },
            { value: "slide", label: "Slide up" },
            { value: "none", label: "None" },
          ]}
        />
      </div>

      <div className="space-y-3 rounded-xl border border-white/8 bg-white/[0.02] p-3">
        <Switch
          checked={draft.uppercase}
          onChange={(value) => update({ uppercase: value })}
          label="UPPERCASE"
        />
        <Switch
          checked={draft.highlightWords}
          onChange={(value) => update({ highlightWords: value })}
          label="Word-by-word highlight"
          description="Active word coloured as it is spoken"
        />
        <Switch
          checked={draft.emoji}
          onChange={(value) => update({ emoji: value })}
          label="Emoji suggestions"
          description="Adds a matching emoji to emotional lines"
        />
        <Switch
          checked={draft.speakerLabels}
          onChange={(value) => update({ speakerLabels: value })}
          label="Speaker labels"
          description="Prefix lines with Speaker 1 / Speaker 2"
        />
      </div>

      <p className="flex items-start gap-1.5 rounded-xl border border-white/8 bg-white/[0.02] p-2.5 text-[10.5px] leading-relaxed text-white/35">
        <Palette className="mt-0.5 size-3 shrink-0" />
        Styles map to real ASS subtitle tags — the preview approximates the burned-in result, so
        re-render to see the final captions in the video.
      </p>
    </div>
  );
}

export function styleFromPreset(styleId: string, allowedStyles: string[]): Partial<CaptionDraft> {
  const map: Record<string, Partial<CaptionDraft>> = {
    mrbeast: {
      fontFamily: "Inter",
      fontSize: 0.072,
      highlightColor: "#5EF0C6",
      outline: 8,
      shadow: 5,
      uppercase: true,
      maxWordsPerLine: 3,
      animation: "pop",
      highlightWords: true,
      emoji: true,
      position: "bottom",
    },
    gaming: {
      fontFamily: "Inter",
      fontSize: 0.066,
      highlightColor: "#A855F7",
      outline: 8,
      shadow: 4,
      uppercase: true,
      maxWordsPerLine: 4,
      animation: "pop",
      highlightWords: true,
      emoji: false,
      position: "bottom",
    },
    podcast: {
      fontFamily: "Inter",
      fontSize: 0.042,
      highlightColor: "#7DD3FC",
      outline: 4,
      shadow: 3,
      uppercase: false,
      maxWordsPerLine: 7,
      animation: "fade",
      highlightWords: false,
      emoji: false,
      position: "bottom",
    },
    minimal: {
      fontFamily: "Inter",
      fontSize: 0.034,
      highlightColor: "#FFFFFF",
      outline: 3,
      shadow: 2,
      uppercase: false,
      maxWordsPerLine: 8,
      animation: "fade",
      highlightWords: false,
      emoji: false,
      position: "bottom",
    },
    bold: {
      fontFamily: "Inter",
      fontSize: 0.078,
      highlightColor: "#FFD84D",
      outline: 9,
      shadow: 6,
      uppercase: true,
      maxWordsPerLine: 2,
      animation: "pop",
      highlightWords: true,
      emoji: true,
      position: "middle",
    },
    karaoke: {
      fontFamily: "Inter",
      fontSize: 0.058,
      highlightColor: "#38BDF8",
      outline: 6,
      shadow: 3,
      uppercase: true,
      maxWordsPerLine: 5,
      animation: "none",
      highlightWords: true,
      emoji: false,
      position: "bottom",
    },
  };
  const safe = allowedStyles.includes(styleId) ? styleId : allowedStyles[0] ?? "minimal";
  return { style: safe, ...(map[safe] ?? {}) };
}
