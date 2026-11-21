"use client";

import { ExternalLink, Hash, Lightbulb, RefreshCw, Sparkles, Type } from "lucide-react";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CopyButton, Divider } from "@/components/ui/misc";
import { Progress } from "@/components/ui/progress";
import { Tabs } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import type { SeoResult } from "@/lib/ai/seo";

export function SeoPanel({
  seo,
  onRegenerate,
  regenerating,
  onTitleChange,
  currentTitle,
}: {
  seo: SeoResult | null;
  onRegenerate: () => void;
  regenerating: boolean;
  onTitleChange: (title: string) => void;
  currentTitle: string;
}) {
  const [platform, setPlatform] = useState<string>("TikTok");

  if (!seo) {
    return (
      <div className="rounded-2xl border border-dashed border-white/12 px-4 py-10 text-center">
        <p className="text-[12.5px] text-white/40">
          Metadata is generated while the clip renders. Check back in a moment.
        </p>
        <Button className="mt-3" size="sm" variant="secondary" loading={regenerating} onClick={onRegenerate}>
          Generate now
        </Button>
      </div>
    );
  }

  const platformTags = seo.platforms?.[platform]?.hashtags ?? seo.hashtags;

  return (
    <div className="space-y-4">
      {/* Scores */}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {[
          ["Title", seo.scores.title],
          ["Description", seo.scores.description],
          ["Hashtags", seo.scores.hashtags],
          ["Overall", seo.scores.overall],
        ].map(([label, value]) => (
          <div key={label as string} className="rounded-xl border border-white/8 bg-white/[0.03] p-2.5">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-white/35">{label}</p>
            <p className="mt-0.5 font-display text-lg font-semibold text-white">{value as number}</p>
            <Progress value={value as number} className="mt-1.5" tone="mint" />
          </div>
        ))}
      </div>

      {/* Titles */}
      <section>
        <div className="mb-2 flex items-center justify-between">
          <h3 className="inline-flex items-center gap-1.5 text-[12px] font-semibold text-white/80">
            <Type className="size-3.5 text-violet-300" /> Viral titles
            <Badge tone="neutral">{seo.titles.length}</Badge>
          </h3>
          <Button
            size="sm"
            variant="ghost"
            loading={regenerating}
            onClick={onRegenerate}
            icon={<RefreshCw className="size-3.5" />}
          >
            Regenerate
          </Button>
        </div>
        <div className="space-y-1.5">
          {seo.titles.map((title) => {
            const active = title === currentTitle;
            return (
              <div
                key={title}
                className={cn(
                  "group flex items-start gap-2 rounded-xl border px-3 py-2 transition",
                  active
                    ? "border-violet-400/40 bg-violet-500/10"
                    : "border-white/8 bg-white/[0.02] hover:border-white/15",
                )}
              >
                <button
                  onClick={() => onTitleChange(title)}
                  className="flex-1 text-left text-[12.5px] leading-snug text-white/80 hover:text-white"
                >
                  {title}
                  {active ? (
                    <span className="ml-2 rounded bg-violet-500/25 px-1.5 py-0.5 text-[9.5px] font-semibold uppercase tracking-wider text-violet-200">
                      in use
                    </span>
                  ) : null}
                </button>
                <CopyButton value={title} label="" className="shrink-0 px-2 py-1" />
              </div>
            );
          })}
        </div>
        <p className="mt-1.5 text-[10.5px] text-white/30">
          Click a title to use it for the clip. Titles are written from the transcript — no invented
          claims.
        </p>
      </section>

      <Divider />

      {/* Description */}
      <section>
        <div className="mb-2 flex items-center justify-between">
          <h3 className="text-[12px] font-semibold text-white/80">Description</h3>
          <CopyButton value={seo.description} />
        </div>
        <textarea
          readOnly
          value={seo.description}
          rows={7}
          className="w-full resize-none rounded-xl border border-white/8 bg-ink-950/50 p-3 text-[12px] leading-relaxed text-white/70 focus:outline-none"
        />
      </section>

      {/* Hashtags */}
      <section>
        <div className="mb-2 flex items-center justify-between">
          <h3 className="inline-flex items-center gap-1.5 text-[12px] font-semibold text-white/80">
            <Hash className="size-3.5 text-electric-400" /> Hashtags
          </h3>
          <CopyButton value={platformTags.join(" ")} label="Copy set" />
        </div>
        <Tabs
          size="sm"
          tabs={Object.keys(seo.platforms ?? { TikTok: {}, "YouTube Shorts": {}, "Instagram Reels": {}, Facebook: {} }).map(
            (id) => ({ id, label: id.replace("Instagram Reels", "Reels").replace("YouTube Shorts", "Shorts") }),
          )}
          value={platform}
          onChange={setPlatform}
          className="mb-2"
        />
        <div className="flex flex-wrap gap-1.5">
          {platformTags.map((tag) => (
            <button
              key={tag}
              onClick={() => navigator.clipboard?.writeText(tag)}
              className="rounded-lg border border-white/10 bg-white/[0.04] px-2 py-1 text-[11.5px] text-white/60 transition hover:border-violet-400/30 hover:text-white"
            >
              {tag}
            </button>
          ))}
        </div>
        {seo.platforms?.[platform]?.note ? (
          <p className="mt-2 flex items-start gap-1.5 text-[10.5px] leading-relaxed text-white/35">
            <Lightbulb className="mt-0.5 size-3 shrink-0 text-amber-400/70" />
            {seo.platforms[platform].note}
          </p>
        ) : null}
      </section>

      <Divider />

      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <h3 className="mb-1.5 inline-flex items-center gap-1.5 text-[12px] font-semibold text-white/80">
            <Sparkles className="size-3.5 text-mint-400" /> Keywords
          </h3>
          <div className="flex flex-wrap gap-1.5">
            {seo.keywords.slice(0, 10).map((keyword) => (
              <span
                key={keyword}
                className="rounded-md border border-white/8 bg-white/[0.03] px-2 py-0.5 text-[11px] text-white/50"
              >
                {keyword}
              </span>
            ))}
          </div>
        </div>
        <div>
          <h3 className="mb-1.5 text-[12px] font-semibold text-white/80">Thumbnail text</h3>
          <div className="flex items-center gap-2">
            <span className="rounded-md bg-gradient-to-r from-violet-500/20 to-electric-500/10 px-2.5 py-1 text-[11.5px] font-bold uppercase tracking-wide text-white">
              {seo.thumbnailText}
            </span>
            <CopyButton value={seo.thumbnailText} label="" className="px-2 py-1" />
          </div>
        </div>
      </div>

      {seo.analysis ? (
        <div className="grid gap-2 sm:grid-cols-2">
          <div className="rounded-xl border border-mint-400/20 bg-mint-400/[0.06] p-3">
            <p className="text-[10.5px] font-semibold uppercase tracking-wider text-mint-300">Working</p>
            <ul className="mt-1 space-y-1 text-[11px] leading-relaxed text-white/50">
              {seo.analysis.strengths.map((item) => (
                <li key={item}>· {item}</li>
              ))}
            </ul>
          </div>
          <div className="rounded-xl border border-amber-400/20 bg-amber-400/[0.05] p-3">
            <p className="text-[10.5px] font-semibold uppercase tracking-wider text-amber-300">
              Improve
            </p>
            <ul className="mt-1 space-y-1 text-[11px] leading-relaxed text-white/50">
              {seo.analysis.improvements.length ? (
                seo.analysis.improvements.map((item) => <li key={item}>· {item}</li>)
              ) : (
                <li>· Metadata looks solid — publish it.</li>
              )}
            </ul>
          </div>
        </div>
      ) : null}

      <p className="flex items-center gap-1.5 text-[10.5px] text-white/30">
        <ExternalLink className="size-3" />
        Generated {seo.generatedBy === "llm" ? "with your LLM provider" : "by the built-in engine"}.
        Always check the source credit before publishing.
      </p>
    </div>
  );
}
