import {
  errorResponse,
  getAdminSummary,
  getDb,
  json,
  normalizeBoolean,
  normalizeMode,
  normalizePrizeName,
  normalizeSortOrder,
  normalizeTotalWinners,
  randomId,
  readJson,
  requireAdmin,
  nowIso
} from "../../../_lib/checkin.js";

export async function onRequestPost(context) {
  try {
    requireAdmin(context.request, context.env);
    const db = getDb(context.env);
    const body = await readJson(context.request);
    const id = typeof body.id === "string" && body.id.trim() ? body.id.trim() : randomId("prize");
    const name = normalizePrizeName(body.name);
    const totalWinners = normalizeTotalWinners(body.totalWinners);
    const enabled = normalizeBoolean(body.enabled) ? 1 : 0;
    const sortOrder = normalizeSortOrder(body.sortOrder);
    const now = nowIso();

    await db
      .prepare(
        `INSERT INTO prizes
          (id, name, total_winners, enabled, sort_order, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET
          name = excluded.name,
          total_winners = excluded.total_winners,
          enabled = excluded.enabled,
          sort_order = excluded.sort_order,
          updated_at = excluded.updated_at`
      )
      .bind(id, name, totalWinners, enabled, sortOrder, now, now)
      .run();

    const mode = normalizeMode(body.mode);
    return json({ ok: true, data: await getAdminSummary(db, mode) });
  } catch (error) {
    return errorResponse(error);
  }
}
