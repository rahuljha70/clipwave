import { json, route } from "@/lib/api";
import { destroyCurrentSession } from "@/lib/auth";

export const POST = route("auth.logout", async () => {
  await destroyCurrentSession();
  return json({ ok: true });
});
