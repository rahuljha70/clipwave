import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth";
import { AdminDashboard } from "@/components/dashboard/admin-dashboard";

export const metadata = { title: "Admin" };

/** Server-side guard: only administrators can load this route. */
export default async function AdminPage() {
  const user = await getSessionUser();
  if (!user) redirect("/login?next=/dashboard/admin");
  if (user.role !== "admin") redirect("/dashboard");
  return <AdminDashboard />;
}
