/** Byte-range aware file streaming for video previews and downloads. */
import fs from "node:fs";
import fsp from "node:fs/promises";
import path from "node:path";

const MIME: Record<string, string> = {
  ".mp4": "video/mp4",
  ".webm": "video/webm",
  ".mov": "video/quicktime",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
  ".srt": "text/plain; charset=utf-8",
  ".vtt": "text/vtt; charset=utf-8",
  ".ass": "text/plain; charset=utf-8",
  ".json": "application/json",
  ".txt": "text/plain; charset=utf-8",
  ".mp3": "audio/mpeg",
  ".wav": "audio/wav",
};

export function contentTypeFor(file: string) {
  return MIME[path.extname(file).toLowerCase()] ?? "application/octet-stream";
}

export async function serveFile(
  req: Request,
  absPath: string,
  opts: { downloadName?: string; cacheSeconds?: number } = {},
): Promise<Response> {
  let stat: fs.Stats;
  try {
    stat = await fsp.stat(absPath);
  } catch {
    return new Response("Not found", { status: 404 });
  }
  if (!stat.isFile()) return new Response("Not found", { status: 404 });

  const type = contentTypeFor(absPath);
  const range = req.headers.get("range");
  const cache = opts.cacheSeconds ?? 0;
  const disposition = opts.downloadName
    ? `attachment; filename="${opts.downloadName.replace(/"/g, "")}"`
    : "inline";

  const headers = new Headers({
    "content-type": type,
    "accept-ranges": "bytes",
    "cache-control": cache > 0 ? `private, max-age=${cache}` : "private, no-cache",
    "content-disposition": disposition,
  });

  if (range) {
    const match = /bytes=(\d*)-(\d*)/.exec(range);
    if (match) {
      const start = match[1] ? Number(match[1]) : 0;
      const end = match[2] ? Math.min(Number(match[2]), stat.size - 1) : stat.size - 1;
      if (start >= stat.size || start > end) {
        return new Response("Range not satisfiable", {
          status: 416,
          headers: { "content-range": `bytes */${stat.size}` },
        });
      }
      headers.set("content-range", `bytes ${start}-${end}/${stat.size}`);
      headers.set("content-length", String(end - start + 1));
      const stream = fs.createReadStream(absPath, { start, end });
      return new Response(stream as unknown as ReadableStream, { status: 206, headers });
    }
  }

  headers.set("content-length", String(stat.size));
  const stream = fs.createReadStream(absPath);
  return new Response(stream as unknown as ReadableStream, { status: 200, headers });
}
