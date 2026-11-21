import { json, readJson, requireUser, route } from "@/lib/api";
import { nowIso, q1, run, type Row } from "@/lib/db";

const DEFAULTS = {
  subtitleStyle: "mrbeast",
  aspect: "9:16",
  targetLength: 30,
  requestedClips: 8,
  autoThumbnail: true,
  defaultLanguage: "auto",
  emailOnComplete: true,
};

export const GET = route("settings.get", async () => {
  const user = await requireUser();
  const row = await q1<Row>(`SELECT settings_json FROM user_settings WHERE user_id = ?`, [user.id]);
  const settings = row ? { ...DEFAULTS, ...JSON.parse(row.settings_json) } : DEFAULTS;
  return json({ settings });
});

export const PUT = route("settings.put", async (req) => {
  const user = await requireUser();
  const body = (await readJson<Record<string, unknown>>(req)) ?? {};
  const row = await q1<Row>(`SELECT settings_json FROM user_settings WHERE user_id = ?`, [user.id]);
  const current = row ? { ...DEFAULTS, ...JSON.parse(row.settings_json) } : DEFAULTS;
  const merged = { ...current, ...body };

  if (row) {
    await run(`UPDATE user_settings SET settings_json = ?, updated_at = ? WHERE user_id = ?`, [
      JSON.stringify(merged),
      nowIso(),
      user.id,
    ]);
  } else {
    await run(`INSERT INTO user_settings (user_id, settings_json, updated_at) VALUES (?, ?, ?)`, [
      user.id,
      JSON.stringify(merged),
      nowIso(),
    ]);
  }
  return json({ settings: merged });
});
