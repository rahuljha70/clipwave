"use client";

import { motion } from "framer-motion";
import { Clock, Film, Sparkles } from "lucide-react";
import Link from "next/link";
import { PlatformBadge, StatusDot } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { cn, formatDuration, relativeTime } from "@/lib/utils";

export interface ProjectDtoLite {
  id: string;
  title: string;
  platform: string | null;
  thumbnailUrl: string | null;
  durationSec: number;
  status: string;
  stage: string | null;
  progress: number;
  clipCount: number;
  readyClips: number;
  error: string | null;
  createdAt: string;
}

export function ProjectCard({ project, index = 0 }: { project: ProjectDtoLite; index?: number }) {
  const isProcessing = project.status === "processing" || project.status === "queued";
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, delay: index * 0.05 }}
    >
      <Link
        href={`/dashboard/projects/${project.id}`}
        className="group glass block overflow-hidden rounded-2xl card-hover hover:-translate-y-0.5 hover:border-violet-400/30"
      >
        <div className="relative aspect-video overflow-hidden bg-ink-900">
          {project.thumbnailUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={project.thumbnailUrl}
              alt=""
              referrerPolicy="no-referrer"
              className="size-full object-cover transition duration-500 group-hover:scale-[1.04]"
            />
          ) : (
            <div className="grid size-full place-items-center bg-[radial-gradient(circle_at_50%_30%,rgba(109,94,248,0.25),transparent_70%)]">
              <Film className="size-7 text-white/25" />
            </div>
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-ink-950/95 via-ink-950/20 to-transparent" />
          <div className="absolute left-2.5 top-2.5 flex items-center gap-1.5">
            <PlatformBadge platform={project.platform} />
          </div>
          <div className="absolute right-2.5 top-2.5 inline-flex items-center gap-1 rounded-md bg-ink-950/75 px-1.5 py-0.5 text-[10.5px] font-medium text-white/80 backdrop-blur">
            <Clock className="size-2.5" /> {formatDuration(project.durationSec)}
          </div>
          <div className="absolute inset-x-2.5 bottom-2.5">
            <p className="line-clamp-2 text-[13px] font-medium leading-snug text-white">
              {project.title}
            </p>
          </div>
        </div>

        <div className="p-3">
          {isProcessing ? (
            <>
              <div className="flex items-center gap-2 text-[11.5px] text-white/55">
                <StatusDot status={project.status} />
                <span className="truncate">{project.stage ?? "Queued"}</span>
              </div>
              <Progress value={project.progress} className="mt-2" showValue />
            </>
          ) : project.status === "failed" ? (
            <p className="line-clamp-2 text-[11.5px] text-rose-300/80">
              {project.error ?? "Processing failed"}
            </p>
          ) : (
            <div className="flex items-center justify-between text-[11.5px] text-white/45">
              <span className="inline-flex items-center gap-1.5 text-mint-400">
                <Sparkles className="size-3.5" /> {project.readyClips} clips
              </span>
              <span>{relativeTime(project.createdAt)}</span>
            </div>
          )}
        </div>
      </Link>
    </motion.div>
  );
}

export function ProjectRow({ project }: { project: ProjectDtoLite }) {
  return (
    <Link
      href={`/dashboard/projects/${project.id}`}
      className={cn(
        "flex items-center gap-3 rounded-2xl border border-white/8 bg-white/[0.025] p-3 transition",
        "hover:border-violet-400/25 hover:bg-white/[0.05]",
      )}
    >
      <div className="relative h-12 w-20 shrink-0 overflow-hidden rounded-lg bg-ink-900">
        {project.thumbnailUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={project.thumbnailUrl} alt="" referrerPolicy="no-referrer" className="size-full object-cover" />
        ) : (
          <div className="grid size-full place-items-center">
            <Film className="size-4 text-white/25" />
          </div>
        )}
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-[13px] font-medium text-white">{project.title}</p>
        <p className="mt-0.5 flex items-center gap-2 text-[11px] text-white/40">
          <StatusDot status={project.status} />
          <span className="capitalize">{project.status}</span>
          <span>·</span>
          <span>{formatDuration(project.durationSec)}</span>
          <span>·</span>
          <span>{project.readyClips} clips</span>
        </p>
      </div>
      {project.status === "processing" ? (
        <div className="w-24 shrink-0">
          <Progress value={project.progress} />
        </div>
      ) : (
        <span className="shrink-0 text-[11px] text-white/30">{relativeTime(project.createdAt)}</span>
      )}
    </Link>
  );
}
