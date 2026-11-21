import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth";
import { getUsage } from "@/lib/entitlements";
import { DashboardShell } from "@/components/dashboard/shell";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const user = await getSessionUser();
  if (!user) redirect("/login?next=/dashboard");

  const usage = await getUsage(user.id, user.plan, user.role === "admin");

  return (
    <DashboardShell
      user={{
        id: user.id,
        email: user.email,
        name: user.name,
        avatarUrl: user.avatar_url,
        role: user.role,
        plan: usage.plan.id,
      }}
      usage={{
        usedMinutes: usage.usedMinutes,
        includedMinutes: usage.includedMinutes,
        remainingMinutes: usage.remainingMinutes,
        percent: usage.percent,
        isUnlimited: usage.isUnlimited,
      }}
    >
      {children}
    </DashboardShell>
  );
}
