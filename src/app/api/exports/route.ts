import { json, requireUser, route } from "@/lib/api";
import { q, type Row } from "@/lib/db";

export const GET = route("exports.list", async (req) => {
  const user = await requireUser();
  const url = new URL(req.url);
  const limit = Math.min(200, Number(url.searchParams.get("limit") ?? 60));
  const rows = await q<Row>(
    `SELECT e.*, c.title AS clip_title, c.viral_score AS clip_score, p.title AS project_title
       FROM exports e
       LEFT JOIN clips c ON c.id = e.clip_id
       LEFT JOIN projects p ON p.id = e.project_id
      WHERE e.user_id = ?
      ORDER BY e.created_at DESC LIMIT ?`,
    [user.id, limit],
  );
  return json({
    exports: rows.map((r) => ({
      id: r.id,
      kind: r.kind,
      aspect: r.aspect,
      resolution: r.resolution,
      fps: r.fps,
      sizeBytes: Number(r.size_bytes ?? 0),
      label: r.label ?? r.clip_title ?? "Export",
      clipId: r.clip_id,
      projectId: r.project_id,
      projectTitle: r.project_title,
      createdAt: r.created_at,
      downloadUrl:
        r.kind === "srt"
          ? `/api/clips/${r.clip_id}/download?kind=srt`
          : `/api/clips/${r.clip_id}/download?kind=video&resolution=${
              Number(String(r.resolution ?? "1080").replace(/\D/g, "")) || 1080
            }`,
    })),
  });
});
