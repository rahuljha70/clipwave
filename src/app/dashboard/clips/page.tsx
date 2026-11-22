"use client";

import { Bookmark, Search, Sparkles } from "lucide-react";
import { useMemo, useState } from "react";
import { ClipCard } from "@/components/dashboard/clip-card";
import { EmptyState } from "@/components/ui/misc";
import { LinkButton } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/progress";
import { Tabs } from "@/components/ui/tabs";
import { useApi } from "@/lib/client/api";
import type { DashboardResponse } from "@/lib/contracts";
import type { ClipDto } from "@/lib/clip-utils";
import type { ProjectDto } from "@/lib/serializers";

export default function ClipsLibraryPage() {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<"all" | "saved">("all");
  const { data: dash, loading: dashLoading } = useApi<DashboardResponse>("/api/dashboard");
  const { data, loading } = useApi<{ projects: ProjectDto[] }>("/api/projects?limit=100");

  // Flatten clips across projects (the dashboard endpoint returns saved clips;
  // project details give us everything else).
  const savedClips = dash?.savedClips;

  const clipCards = useMemo(() => {
    return (savedClips ?? []).filter((clip: ClipDto) =>
      query ? clip.title?.toLowerCase().includes(query.toLowerCase()) : true,
    );
  }, [savedClips, query]);

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold tracking-tight text-white">Clip library</h1>
          <p className="mt-1 text-[13px] text-white/50">
            Clips you bookmarked across projects. Open any project to see its full set.
          </p>
        </div>
        <LinkButton href="/dashboard/projects" variant="secondary" size="sm">
          Browse projects
        </LinkButton>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <Tabs
          tabs={[
            { id: "all", label: "Saved clips" },
            { id: "saved", label: "Bookmarked" },
          ]}
          value={filter}
          onChange={(id) => setFilter(id as typeof filter)}
        />
        <div className="relative w-full sm:w-64">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-white/30" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search saved clips…"
            className="h-10 w-full rounded-xl border border-white/10 bg-ink-900/60 pl-9 pr-3 text-[13px] text-white placeholder:text-white/30 focus:border-violet-400/50 focus:outline-none"
          />
        </div>
      </div>

      {loading && dashLoading && !dash ? (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="aspect-[9/16] rounded-2xl" />
          ))}
        </div>
      ) : clipCards.length ? (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
          {clipCards.map((clip, i: number) => (
            <ClipCard key={clip.id} clip={clip} index={i} />
          ))}
        </div>
      ) : (
        <EmptyState
          icon={Bookmark}
          title="No saved clips yet"
          description="Open a project and tap the bookmark on any clip to keep it in this library."
          action={
            <LinkButton href="/dashboard/projects" size="sm" icon={<Sparkles className="size-4" />}>
              Open projects
            </LinkButton>
          }
        />
      )}

      {data?.projects?.length ? (
        <p className="text-center text-[11.5px] text-white/25">
          {data.projects.length} projects available · bookmarks sync instantly
        </p>
      ) : null}
    </div>
  );
}
