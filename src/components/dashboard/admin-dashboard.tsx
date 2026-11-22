"use client";

import {
  Activity,
  AlertTriangle,
  Ban,
  DollarSign,
  Film,
  HardDrive,
  RotateCcw,
  Search,
  ShieldAlert,
  Sparkles,
  Users,
} from "lucide-react";
import { useState } from "react";
import { GlassCard, StatCard } from "@/components/ui/card";
import { Badge, PlanBadge, StatusDot } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/field";
import { Skeleton } from "@/components/ui/progress";
import { Tabs } from "@/components/ui/tabs";
import { EmptyState } from "@/components/ui/misc";
import { useToast } from "@/components/ui/toast";
import { apiPatch, apiPost, useApi } from "@/lib/client/api";
import { errorMessage, formatBytes, relativeTime } from "@/lib/utils";
import type { AdminError, AdminFailedJob, AdminJob, AdminStats, AdminUser } from "@/lib/contracts";

type Tab = "overview" | "users" | "jobs" | "errors";

export function AdminDashboard() {
  const toast = useToast();
  const [tab, setTab] = useState<Tab>("overview");
  const [query, setQuery] = useState("");
  const [userFilter, setUserFilter] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [creditAdjust, setCreditAdjust] = useState<Record<string, string>>({});

  const { data: stats, loading: statsLoading, refresh: refreshStats } = useApi<AdminStats>("/api/admin/stats");
  const { data: usersData, refresh: refreshUsers } = useApi<{ users: AdminUser[] }>(
    `/api/admin/users?limit=100${query ? `&q=${encodeURIComponent(query)}` : ""}${userFilter ? `&plan=${userFilter}` : ""}`,
  );
  const { data: jobsData, refresh: refreshJobs } = useApi<{ jobs: AdminJob[]; counts: Record<string, number> }>(
    "/api/admin/jobs?limit=100",
    { refreshMs: tab === "jobs" ? 5000 : undefined },
  );
  const { data: errorsData } = useApi<{ errors: AdminError[]; failedJobs: AdminFailedJob[] }>(
    "/api/admin/errors",
  );

  const updateUser = async (id: string, patch: Record<string, unknown>) => {
    setBusy(id);
    try {
      await apiPatch(`/api/admin/users/${id}`, patch);
      toast.success("User updated");
      await Promise.all([refreshUsers(), refreshStats()]);
    } catch (err: unknown) {
      toast.error(errorMessage(err, "Update failed"));
    } finally {
      setBusy(null);
    }
  };

  const adjustCredits = async (id: string, sign: 1 | -1) => {
    const minutes = Number(creditAdjust[id] ?? 10);
    if (!minutes) return;
    await updateUser(id, { creditAdjustSeconds: sign * minutes * 60, reason: "Admin credit adjustment" });
  };

  const jobAction = async (id: string, action: "cancel" | "retry") => {
    setBusy(id);
    try {
      await apiPost(`/api/admin/jobs/${id}`, { action });
      toast.success(`Job ${action === "cancel" ? "canceled" : "requeued"}`);
      await refreshJobs();
    } catch (err: unknown) {
      toast.error(errorMessage(err, "Action failed"));
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="inline-flex items-center gap-2 font-display text-2xl font-bold tracking-tight text-white">
            <ShieldAlert className="size-5 text-rose-400" /> Admin
          </h1>
          <p className="mt-1 text-[13px] text-white/50">
            Platform-wide metrics, user management and job control.
          </p>
        </div>
        <Tabs
          tabs={[
            { id: "overview", label: "Overview" },
            { id: "users", label: "Users" },
            { id: "jobs", label: "Jobs" },
            { id: "errors", label: "Errors" },
          ]}
          value={tab}
          onChange={(id) => setTab(id as Tab)}
        />
      </div>

      {tab === "overview" ? (
        statsLoading && !stats ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {Array.from({ length: 8 }).map((_, i) => (
              <Skeleton key={i} className="h-28 rounded-3xl" />
            ))}
          </div>
        ) : (
          <>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <StatCard
                label="Registered users"
                value={stats?.users.total ?? 0}
                hint={`${stats?.users.paying ?? 0} paying`}
                icon={<Users className="size-4.5" />}
                accent="violet"
              />
              <StatCard
                label="MRR (estimated)"
                value={`$${stats?.revenue.mrr ?? 0}`}
                hint={`ARR $${stats?.revenue.arr ?? 0}`}
                icon={<DollarSign className="size-4.5" />}
                accent="mint"
              />
              <StatCard
                label="Videos processed"
                value={stats?.projects.total ?? 0}
                hint={`${stats?.projects.processedMinutes ?? 0} min analysed`}
                icon={<Film className="size-4.5" />}
                accent="electric"
              />
              <StatCard
                label="Clips generated"
                value={stats?.clips.total ?? 0}
                hint={`${stats?.clips.ready ?? 0} ready`}
                icon={<Sparkles className="size-4.5" />}
                accent="amber"
              />
            </div>

            <div className="grid gap-4 lg:grid-cols-3">
              <GlassCard className="p-5">
                <h2 className="text-[13px] font-semibold text-white">Subscriptions</h2>
                <div className="mt-3 space-y-2.5">
                  {Object.entries(stats?.users.byPlan ?? {}).map(([plan, count]) => (
                    <div key={plan} className="flex items-center justify-between">
                      <PlanBadge plan={plan} />
                      <span className="font-display text-lg font-semibold text-white">
                        {count as number}
                      </span>
                    </div>
                  ))}
                </div>
              </GlassCard>

              <GlassCard className="p-5">
                <h2 className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-white">
                  <Activity className="size-4 text-electric-400" /> Job pipeline
                </h2>
                <div className="mt-3 space-y-2">
                  {Object.entries(stats?.jobs ?? {}).map(([status, count]) => (
                    <div key={status} className="flex items-center justify-between text-[12.5px]">
                      <span className="inline-flex items-center gap-2 capitalize text-white/60">
                        <StatusDot status={status} /> {status}
                      </span>
                      <span className="font-mono text-white/70">{count as number}</span>
                    </div>
                  ))}
                  {!Object.keys(stats?.jobs ?? {}).length ? (
                    <p className="text-[12px] text-white/30">No jobs yet.</p>
                  ) : null}
                </div>
              </GlassCard>

              <GlassCard className="p-5">
                <h2 className="text-[13px] font-semibold text-white">System</h2>
                <div className="mt-3 space-y-2 text-[12.5px]">
                  <div className="flex items-center justify-between">
                    <span className="inline-flex items-center gap-1.5 text-white/60">
                      <HardDrive className="size-3.5" /> Storage
                    </span>
                    <span className="font-mono text-white/70">
                      {formatBytes(stats?.storageBytes ?? 0)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="inline-flex items-center gap-1.5 text-white/60">
                      <AlertTriangle className="size-3.5" /> Errors (7d)
                    </span>
                    <span
                      className={
                        (stats?.errors7d ?? 0) > 0 ? "font-mono text-rose-300" : "font-mono text-mint-400"
                      }
                    >
                      {stats?.errors7d ?? 0}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-white/60">Failed projects</span>
                    <span className="font-mono text-white/70">{stats?.projects.failed ?? 0}</span>
                  </div>
                </div>
                <div className="mt-4">
                  <p className="text-[10.5px] font-semibold uppercase tracking-wider text-white/30">
                    Newest accounts
                  </p>
                  <div className="mt-1.5 space-y-1">
                    {(stats?.users.new ?? []).map((user) => (
                      <p key={user.id} className="truncate text-[11.5px] text-white/45">
                        {user.email} · {user.projects} projects
                      </p>
                    ))}
                  </div>
                </div>
              </GlassCard>
            </div>
          </>
        )
      ) : null}

      {tab === "users" ? (
        <GlassCard className="p-4">
          <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-white/30" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search by email or name…"
                className="h-10 w-full rounded-xl border border-white/10 bg-ink-900/60 pl-9 pr-3 text-[13px] text-white placeholder:text-white/30 focus:border-violet-400/50 focus:outline-none"
              />
            </div>
            <Select
              value={userFilter}
              onChange={setUserFilter}
              className="w-full sm:w-44"
              options={[
                { value: "", label: "All plans" },
                { value: "free", label: "Free" },
                { value: "pro", label: "Pro" },
                { value: "ultimate", label: "Ultimate" },
              ]}
            />
          </div>

          <div className="overflow-x-auto">
            <table className="w-full min-w-[860px] text-left">
              <thead>
                <tr className="border-b border-white/8 text-[10.5px] uppercase tracking-wider text-white/35">
                  <th className="px-3 py-2 font-semibold">User</th>
                  <th className="px-3 py-2 font-semibold">Plan</th>
                  <th className="px-3 py-2 font-semibold">Role</th>
                  <th className="px-3 py-2 font-semibold">Projects</th>
                  <th className="px-3 py-2 font-semibold">Min (mo)</th>
                  <th className="px-3 py-2 font-semibold">Credits</th>
                </tr>
              </thead>
              <tbody>
                {(usersData?.users ?? []).map((user) => (
                  <tr key={user.id} className="border-b border-white/5 text-[12px]">
                    <td className="px-3 py-2.5">
                      <p className="font-medium text-white/85">{user.name ?? "—"}</p>
                      <p className="text-[11px] text-white/35">{user.email}</p>
                    </td>
                    <td className="px-3 py-2.5">
                      <select
                        value={user.plan}
                        disabled={busy === user.id}
                        onChange={(e) => updateUser(user.id, { plan: e.target.value })}
                        className="rounded-lg border border-white/10 bg-ink-900 px-2 py-1 text-[11.5px] text-white focus:outline-none"
                      >
                        <option value="free">free</option>
                        <option value="pro">pro</option>
                        <option value="ultimate">ultimate</option>
                      </select>
                    </td>
                    <td className="px-3 py-2.5">
                      <select
                        value={user.role}
                        disabled={busy === user.id}
                        onChange={(e) => updateUser(user.id, { role: e.target.value })}
                        className="rounded-lg border border-white/10 bg-ink-900 px-2 py-1 text-[11.5px] text-white focus:outline-none"
                      >
                        <option value="user">user</option>
                        <option value="admin">admin</option>
                      </select>
                    </td>
                    <td className="px-3 py-2.5 font-mono text-white/60">{user.projects}</td>
                    <td className="px-3 py-2.5 font-mono text-white/60">{user.minutesThisMonth}</td>
                    <td className="px-3 py-2.5">
                      <div className="flex items-center gap-1">
                        <input
                          value={creditAdjust[user.id] ?? "10"}
                          onChange={(e) =>
                            setCreditAdjust((prev) => ({ ...prev, [user.id]: e.target.value }))
                          }
                          className="h-7 w-14 rounded-lg border border-white/10 bg-ink-900 px-1.5 text-[11px] text-white focus:outline-none"
                        />
                        <button
                          onClick={() => adjustCredits(user.id, 1)}
                          disabled={busy === user.id}
                          className="rounded-md bg-mint-400/20 px-1.5 py-1 text-[10.5px] font-semibold text-mint-300 hover:bg-mint-400/30"
                        >
                          +
                        </button>
                        <button
                          onClick={() => adjustCredits(user.id, -1)}
                          disabled={busy === user.id}
                          className="rounded-md bg-rose-500/20 px-1.5 py-1 text-[10.5px] font-semibold text-rose-300 hover:bg-rose-500/30"
                        >
                          −
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!(usersData?.users ?? []).length ? (
              <p className="py-8 text-center text-[12.5px] text-white/30">No users match.</p>
            ) : null}
          </div>
        </GlassCard>
      ) : null}

      {tab === "jobs" ? (
        <GlassCard className="p-4">
          <div className="mb-3 flex flex-wrap gap-2">
            {Object.entries(jobsData?.counts ?? {}).map(([status, count]) => (
              <Badge key={status} tone={status === "failed" ? "rose" : status === "running" ? "electric" : "neutral"}>
                {status}: {count as number}
              </Badge>
            ))}
            <Button size="sm" variant="ghost" onClick={() => void refreshJobs()} className="ml-auto">
              Refresh
            </Button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[800px] text-left">
              <thead>
                <tr className="border-b border-white/8 text-[10.5px] uppercase tracking-wider text-white/35">
                  <th className="px-3 py-2 font-semibold">Job</th>
                  <th className="px-3 py-2 font-semibold">Status</th>
                  <th className="px-3 py-2 font-semibold">Stage</th>
                  <th className="px-3 py-2 font-semibold">User</th>
                  <th className="px-3 py-2 font-semibold">When</th>
                  <th className="px-3 py-2 font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody>
                {(jobsData?.jobs ?? []).map((job) => (
                  <tr key={job.id} className="border-b border-white/5 text-[12px]">
                    <td className="px-3 py-2.5">
                      <p className="font-mono text-[11px] text-white/70">{job.type}</p>
                      <p className="max-w-[220px] truncate text-[11px] text-white/35">
                        {job.projectTitle ?? "—"}
                      </p>
                    </td>
                    <td className="px-3 py-2.5">
                      <span className="inline-flex items-center gap-1.5 capitalize text-white/70">
                        <StatusDot status={job.status} /> {job.status}
                      </span>
                    </td>
                    <td className="max-w-[240px] truncate px-3 py-2.5 text-white/50">
                      {job.error ? <span className="text-rose-300/80">{job.error}</span> : job.stage ?? "—"}
                    </td>
                    <td className="px-3 py-2.5 text-[11px] text-white/45">{job.userEmail ?? "—"}</td>
                    <td className="px-3 py-2.5 text-[11px] text-white/35">{relativeTime(job.createdAt)}</td>
                    <td className="px-3 py-2.5">
                      <div className="flex gap-1">
                        <button
                          onClick={() => jobAction(job.id, "retry")}
                          disabled={busy === job.id}
                          className="rounded-md border border-white/10 bg-white/5 p-1.5 text-white/60 hover:text-white"
                          title="Requeue"
                        >
                          <RotateCcw className="size-3.5" />
                        </button>
                        <button
                          onClick={() => jobAction(job.id, "cancel")}
                          disabled={busy === job.id}
                          className="rounded-md border border-white/10 bg-white/5 p-1.5 text-rose-300/80 hover:text-rose-200"
                          title="Cancel"
                        >
                          <Ban className="size-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!(jobsData?.jobs ?? []).length ? (
              <p className="py-8 text-center text-[12.5px] text-white/30">No jobs yet.</p>
            ) : null}
          </div>
        </GlassCard>
      ) : null}

      {tab === "errors" ? (
        <div className="grid gap-4 lg:grid-cols-2">
          <GlassCard className="p-4">
            <h2 className="mb-2 text-[13px] font-semibold text-white">Application errors</h2>
            <div className="max-h-[30rem] space-y-2 overflow-y-auto">
              {(errorsData?.errors ?? []).map((error) => (
                <div key={error.id} className="rounded-xl border border-rose-400/15 bg-rose-500/[0.06] p-2.5">
                  <p className="text-[11.5px] font-medium text-rose-200">{error.message}</p>
                  <p className="mt-0.5 font-mono text-[10px] text-white/35">
                    {error.scope} · {relativeTime(error.createdAt)}
                  </p>
                  {error.stack ? (
                    <pre className="mt-1 max-h-24 overflow-auto whitespace-pre-wrap text-[9.5px] leading-relaxed text-white/25">
                      {String(error.stack).slice(0, 600)}
                    </pre>
                  ) : null}
                </div>
              ))}
              {!(errorsData?.errors ?? []).length ? (
                <EmptyState icon={AlertTriangle} title="No errors logged" description="Clean logs — nice." />
              ) : null}
            </div>
          </GlassCard>

          <GlassCard className="p-4">
            <h2 className="mb-2 text-[13px] font-semibold text-white">Failed jobs</h2>
            <div className="max-h-[30rem] space-y-2 overflow-y-auto">
              {(errorsData?.failedJobs ?? []).map((job) => (
                <div key={job.id} className="rounded-xl border border-white/8 bg-white/[0.03] p-2.5">
                  <p className="text-[11.5px] text-white/75">{job.projectTitle ?? job.type}</p>
                  <p className="mt-0.5 text-[10.5px] text-rose-300/70">{job.error}</p>
                  <p className="mt-0.5 text-[10px] text-white/25">{relativeTime(job.createdAt)}</p>
                </div>
              ))}
              {!(errorsData?.failedJobs ?? []).length ? (
                <p className="py-8 text-center text-[12.5px] text-white/30">No failed jobs.</p>
              ) : null}
            </div>
          </GlassCard>
        </div>
      ) : null}
    </div>
  );
}
