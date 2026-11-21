import { CreateProjectForm } from "@/components/dashboard/create-project-form";
import { getSessionUser } from "@/lib/auth";
import { getEffectivePlan } from "@/lib/plans";
import { redirect } from "next/navigation";

export const metadata = { title: "New project" };

export default async function NewProjectPage() {
  const user = await getSessionUser();
  if (!user) redirect("/login?next=/dashboard/new");
  const plan = getEffectivePlan(user.plan, user.role === "admin");

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-bold tracking-tight text-white">New project</h1>
        <p className="mt-1 text-[13.5px] text-white/50">
          Import a YouTube or Kick link, or upload a file you own. Everything else is automatic.
        </p>
      </div>
      <CreateProjectForm plan={plan.id} allowedStyles={plan.subtitleStyles} isAdmin={user.role === "admin"} />
    </div>
  );
}
