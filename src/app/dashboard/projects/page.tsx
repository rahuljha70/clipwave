"use client";

import { Film, Plus, Search } from "lucide-react";
import { useMemo, useState } from "react";
import { ProjectCard } from "@/components/dashboard/project-card";
import { EmptyState } from "@/components/ui/misc";
import { LinkButton } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/progress";
import { Tabs } from "@/components/ui/tabs";
import { useApi } from "@/lib/client/api";

type Filter = "all" | "ready" | "processing" | "failed";

export default function ProjectsPage() {
  const [filter, setFilter] = useState<Filter>("all");
  const [query, setQuery] = useState("");
  const { data, loading } = useApi<{ projects: any[] }>("/api/projects?limit=100", {
    refreshMs: 8000,
  });

  const projects = useMemo(() => {
    const list = data?.projects ?? [];
    return list.filter((project) => {
      const matchesFilter =
        filter === "all"
          ? true
          : filter === "processing"
            ? project.status === "processing" || project.status === "queued"
            : project.status === filter;
      const matchesQuery = query
        ? project.title.toLowerCase().includes(query.toLowerCase())
        : true;
      return matchesFilter && matchesQuery;
    });
  }, [data, filter, query]);

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold tracking-tight text-white">Projects</h1>
          <p className="mt-1 text-[13px] text-white/50">
            Each project keeps its transcript, moment scores and rendered clips.
          </p>
        </div>
        <LinkButton href="/dashboard/new" icon={<Plus className="size-4" />}>
          New project
        </LinkButton>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <Tabs
          tabs={[
            { id: "all", label: "All" },
            { id: "ready", label: "Ready" },
            { id: "processing", label: "Processing" },
            { id: "failed", label: "Failed" },
          ]}
          value={filter}
          onChange={(id) => setFilter(id as Filter)}
        />
        <div className="relative w-full sm:w-64">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-white/30" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search projects…"
            className="h-10 w-full rounded-xl border border-white/10 bg-ink-900/60 pl-9 pr-3 text-[13px] text-white placeholder:text-white/30 focus:border-violet-400/50 focus:outline-none"
          />
        </div>
      </div>

      {loading && !data ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="h-56 rounded-2xl" />
          ))}
        </div>
      ) : projects.length ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {projects.map((project, i) => (
            <ProjectCard key={project.id} project={project} index={i} />
          ))}
        </div>
      ) : (
        <EmptyState
          icon={Film}
          title={query ? "No projects match that search" : "No projects here yet"}
          description={
            query
              ? "Try a different title or clear the filters."
              : "Paste a YouTube or Kick link to generate your first set of clips."
          }
          action={
            !query ? (
              <LinkButton href="/dashboard/new" size="sm" icon={<Plus className="size-4" />}>
                New project
              </LinkButton>
            ) : null
          }
        />
      )}
    </div>
  );
}
