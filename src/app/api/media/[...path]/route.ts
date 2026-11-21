import path from "node:path";
import { forbidden, notFound, requireUser, route } from "@/lib/api";
import { absPath, existsRel } from "@/lib/storage";
import { serveFile } from "@/lib/http-file";
import { q1, type Row } from "@/lib/db";

type Ctx = { params: Promise<{ path: string[] }> };

/**
 * Authenticated media gateway. Files are only served when the requester owns the
 * project (or is an admin), so rendered clips are never publicly enumerable.
 */
export const GET = route<Ctx>("media.get", async (req, ctx) => {
  const { path: segments } = await ctx.params;
  const rel = segments.join("/");
  if (rel.includes("..")) throw forbidden();
  const user = await requireUser();

  const parts = rel.split("/");
  if (parts[0] === "projects" && parts[1]) {
    const project = await q1<Row>(`SELECT user_id FROM projects WHERE id = ?`, [parts[1]]);
    if (!project) throw notFound("File not found.");
    if (project.user_id !== user.id && user.role !== "admin") throw forbidden();
  } else {
    if (user.role !== "admin") throw forbidden();
  }

  if (!(await existsRel(rel))) throw notFound("File not found.");
  const url = new URL(req.url);
  const download = url.searchParams.get("download");
  return serveFile(req, absPath(rel), {
    downloadName: download ? path.basename(rel) : undefined,
    cacheSeconds: 3600,
  });
});
