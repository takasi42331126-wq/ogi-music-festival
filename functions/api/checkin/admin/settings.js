import {
  errorResponse,
  getAdminSummary,
  getDb,
  json,
  normalizeBoolean,
  normalizeMode,
  normalizeWinRate,
  readJson,
  requireAdmin,
  nowIso
} from "../../../_lib/checkin.js";

export async function onRequestPost(context) {
  try {
    requireAdmin(context.request, context.env);
    const db = getDb(context.env);
    const body = await readJson(context.request);
    const mode = normalizeMode(body.mode);
    const now = nowIso();
    const winRate = normalizeWinRate(body.winRatePercent);
    const drawOpen = normalizeBoolean(body.drawOpen) ? "true" : "false";

    await db.batch([
      db
        .prepare(
          `INSERT INTO settings (key, mode, value, updated_at)
          VALUES ('win_rate_percent', ?, ?, ?)
          ON CONFLICT(key, mode) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`
        )
        .bind(mode, winRate, now),
      db
        .prepare(
          `INSERT INTO settings (key, mode, value, updated_at)
          VALUES ('draw_open', ?, ?, ?)
          ON CONFLICT(key, mode) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`
        )
        .bind(mode, drawOpen, now)
    ]);

    return json({ ok: true, data: await getAdminSummary(db, mode) });
  } catch (error) {
    return errorResponse(error);
  }
}
