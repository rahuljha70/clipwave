import fs from "node:fs/promises";
import path from "node:path";
import { badRequest, forbidden, json, notFound, requireUser, route } from "@/lib/api";
import { absPath } from "@/lib/storage";

type Ctx = { params: Promise<{ id: string }> };

/** Chunked upload — step 2: append one raw chunk (sent sequentially by the client). */
export const PUT = route<Ctx>("upload.chunk", async (req, ctx) => {
  const { id } = await ctx.params;
  const user = await requireUser();
  if (!/^[a-f0-9-]{36}$/i.test(id)) throw badRequest("Invalid upload id.");

  const dir = absPath(path.posix.join("uploads", id));
  let meta;
  try {
    meta = JSON.parse(await fs.readFile(path.join(dir, "meta.json"), "utf8"));
  } catch {
    throw notFound("Upload session not found.");
  }
  if (meta.userId !== user.id) throw forbidden();

  const buffer = Buffer.from(await req.arrayBuffer());
  if (!buffer.length) throw badRequest("Empty chunk.");
  const file = path.join(dir, `source${meta.ext}`);
  await fs.appendFile(file, buffer);
  const stat = await fs.stat(file);
  return json({ received: stat.size, expected: meta.size });
});
