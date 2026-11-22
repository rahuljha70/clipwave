import type { ClipDto } from "./clip-utils";
import type { Moment } from "./ai/analyze";
import type { SessionUser } from "./auth";
import type { UsageSummary } from "./entitlements";
import type { PlanLimits } from "./plans";
import type { ProjectDto } from "./serializers";
import type { Word } from "./media/subtitles";

export interface UsagePoint {
  day: string;
  minutes: number;
  clips: number;
}

export interface QueueItem {
  id: string;
  type: string;
  status: string;
  stage: string | null;
  progress: number;
  projectId: string | null;
  projectTitle: string | null;
  createdAt: string;
}

export interface DashboardResponse {
  usage: UsageSummary;
  series: UsagePoint[];
  stats: {
    projects: number;
    clips: number;
    readyClips: number;
    savedClips: number;
    exports: number;
    processedMinutes: number;
    storageBytes: number;
  };
  recentProjects: ProjectDto[];
  savedClips: ClipDto[];
  queue: QueueItem[];
}

export interface ExportDto {
  id: string;
  kind: string;
  aspect: string | null;
  resolution: string | null;
  fps: number | null;
  sizeBytes: number;
  label: string;
  clipId: string | null;
  projectId: string | null;
  projectTitle: string | null;
  createdAt: string;
  downloadUrl: string;
}

export interface ProjectLog {
  message: string;
  level: string;
  created_at: string;
}

export interface ProjectExport {
  id: string;
  label?: string | null;
  kind: string;
  resolution?: string | null;
  created_at: string;
  clip_id: string | null;
}

export interface ProjectDetailsResponse {
  project: ProjectDto & {
    analysis: { analysis?: { mode?: string; sentences?: number; baselineDb?: number } | null } | null;
    moments: Moment[];
    mediaReady: boolean;
  };
  clips: ClipDto[];
  job: { id: string; status: string; stage: string | null; progress: number; error: string | null; attempts: number } | null;
  logs: ProjectLog[];
  exports: ProjectExport[];
}

export interface ClipStudioResponse {
  clip: ClipDto;
  project: ProjectDto | null;
  words: Word[];
  siblingCount: number;
  plan: { id: string; name: string; subtitleStyles: string[]; maxResolution: number; maxFps: number; watermark: boolean };
}

export interface PublicUser {
  id: string;
  email: string;
  name: string | null;
  avatarUrl: string | null;
  role: SessionUser["role"];
  plan: SessionUser["plan"];
  planStatus: string;
  planRenewsAt: string | null;
  provider: string;
  createdAt: string;
}

export interface AuthMeResponse {
  user: PublicUser | null;
  usage: UsageSummary | null;
}

export interface BillingResponse {
  user: PublicUser;
  usage: UsageSummary;
  series: UsagePoint[];
  plans: PlanLimits[];
  counts: { projects: number; clips: number };
}

export interface UserSettings {
  subtitleStyle: string;
  aspect: string;
  targetLength: number;
  requestedClips: number;
  autoThumbnail: boolean;
  defaultLanguage: string;
  emailOnComplete: boolean;
}

export interface AdminUser {
  id: string;
  email: string;
  name: string | null;
  role: string;
  plan: string;
  planStatus: string;
  provider: string;
  createdAt: string;
  projects: number;
  clips: number;
  minutesThisMonth: number;
}

export interface AdminJob {
  id: string;
  type: string;
  status: string;
  stage: string | null;
  progress: number;
  attempts: number;
  error: string | null;
  projectId: string | null;
  projectTitle: string | null;
  userEmail: string | null;
  workerId: string | null;
  createdAt: string;
  finishedAt: string | null;
}

export interface AdminError {
  id: string;
  level: string;
  scope: string;
  message: string;
  stack: string | null;
  context: unknown;
  createdAt: string;
}

export interface AdminStats {
  users: {
    total: number;
    byPlan: Record<string, number>;
    paying: number;
    new: Array<{ id: string; email: string; name: string | null; plan: string; role: string; created_at: string; projects: number }>;
  };
  revenue: { mrr: number; arr: number; arpu: number; note: string };
  projects: { total: number; ready: number; failed: number; processedMinutes: number };
  clips: { total: number; ready: number };
  jobs: Record<string, number>;
  errors7d: number;
  storageBytes: number;
}

export interface AdminFailedJob {
  id: string;
  type: string;
  error: string | null;
  projectTitle: string | null;
  createdAt: string;
}
