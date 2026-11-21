"use client";

import { Download, FileText, Image as ImageIcon, Video } from "lucide-react";
import Link from "next/link";
import { GlassCard } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/progress";
import { EmptyState } from "@/components/ui/misc";
import { Tabs } from "@/components/ui/tabs";
import { useApi } from "@/lib/client/api";
import { useState } from "react";
import { formatBytes, relativeTime } from "@/lib/utils";

export default function ExportsPage() {
  const [filter, setFilter] = useState<"all" | "video" | "srt">("all");
  const { data, loading } = useApi<{ exports: any[] }>("/api/exports?limit=120");

  const exports = (data?.exports ?? []).filter((row) =>
    filter === "all" ? true : row.kind === filter,
  );

  const totals = (data?.exports ?? []).reduce(
    (acc, row) => {
      acc.count += 1;
      acc.bytes += Number(row.sizeBytes ?? 0);
      return acc;
    },
    { count: 0, bytes: 0 },
  );

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold tracking-tight text-white">Exports</h1>
          <p className="mt-1 text-[13px] text-white/50">
            Every download is logged — {totals.count} exports, {formatBytes(totals.bytes)} delivered.
          </p>
        </div>
        <Tabs
          tabs={[
            { id: "all", label: "All" },
            { id: "video", label: "Videos" },
            { id: "srt", label: "Subtitles" },
          ]}
          value={filter}
          onChange={(id) => setFilter(id as typeof filter)}
        />
      </div>

      <GlassCard className="overflow-hidden">
        {loading && !data ? (
          <div className="space-y-2 p-4">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-14 w-full" />
            ))}
          </div>
        ) : exports.length ? (
          <div className="divide-y divide-white/6">
            {exports.map((row) => (
              <div key={row.id} className="flex items-center gap-3 px-4 py-3 transition hover:bg-white/[0.02]">
                <span className="grid size-9 shrink-0 place-items-center rounded-xl border border-white/10 bg-white/5 text-white/60">
                  {row.kind === "srt" ? (
                    <FileText className="size-4" />
                  ) : row.kind === "thumb" ? (
                    <ImageIcon className="size-4" />
                  ) : (
                    <Video className="size-4" />
                  )}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[12.5px] font-medium text-white">{row.label}</p>
                  <p className="mt-0.5 flex flex-wrap items-center gap-2 text-[11px] text-white/35">
                    {row.projectTitle ? (
                      <Link href={`/dashboard/projects/${row.projectId}`} className="hover:text-white">
                        {row.projectTitle}
                      </Link>
                    ) : null}
                    <span>·</span>
                    <span>{relativeTime(row.createdAt)}</span>
                    {row.sizeBytes ? (
                      <>
                        <span>·</span>
                        <span>{formatBytes(row.sizeBytes)}</span>
                      </>
                    ) : null}
                  </p>
                </div>
                <div className="hidden items-center gap-1.5 sm:flex">
                  {row.resolution ? <Badge tone="neutral">{row.resolution}</Badge> : null}
                  {row.aspect ? <Badge tone="neutral">{row.aspect}</Badge> : null}
                  {row.fps ? <Badge tone="neutral">{row.fps} fps</Badge> : null}
                </div>
                <a
                  href={row.downloadUrl}
                  className="inline-flex h-8 shrink-0 items-center gap-1.5 rounded-lg border border-white/10 bg-white/5 px-2.5 text-[11.5px] text-white/70 transition hover:bg-white/12 hover:text-white"
                >
                  <Download className="size-3.5" /> Download
                </a>
              </div>
            ))}
          </div>
        ) : (
          <EmptyState
            icon={Download}
            title="No exports yet"
            description="Download a clip from the studio and it will appear here with its settings."
          />
        )}
      </GlassCard>
    </div>
  );
}
