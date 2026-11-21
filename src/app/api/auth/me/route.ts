import { json, route } from "@/lib/api";
import { getSessionUser, publicUser } from "@/lib/auth";
import { getUsage } from "@/lib/entitlements";

export const GET = route("auth.me", async () => {
  const user = await getSessionUser();
  if (!user) return json({ user: null, usage: null });
  const usage = await getUsage(user.id, user.plan, user.role === "admin");
  return json({ user: publicUser(user), usage });
});
