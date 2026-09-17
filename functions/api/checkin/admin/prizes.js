import {
  errorResponse,
  getAdminSummary,
  getDb,
  json,
  ensurePrizeVenueLimits,
  normalizeBoolean,
  normalizeMode,
  normalizePrizeName,
  normalizeSortOrder,
  normalizeTotalWinners,
  normalizeVenueLimits,
  randomId,
  readJson,
  requireAdmin,
  nowIso,
  sumVenueLimits
} from "../../../_lib/checkin.js";

export async function onRequestPost(context) {
  try {
    requireAdmin(context.request, context.env);
    const db = getDb(context.env);
    const body = await readJson(context.request);
    await ensurePrizeVenueLimits(db);
    const id = typeof body.id === "string" && body.id.trim() ? body.id.trim() : randomId("prize");
    const name = normalizePrizeName(body.name);
    const venueLimits = normalizeVenueLimits(body.venueLimits, normalizeTotalWinners(body.totalWinners ?? 0));
    const totalWinners = sumVenueLimits(venueLimits);
    const enabled = normalizeBoolean(body.enabled) ? 1 : 0;
    const sortOrder = normalizeSortOrder(body.sortOrder);
    const now = nowIso();

    await db.batch([
      db
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
        .bind(id, name, totalWinners, enabled, sortOrder, now, now),
      ...venueLimits.map((venue) =>
        db
          .prepare(
            `INSERT INTO prize_venue_limits
              (prize_id, venue_id, total_winners, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?)
            ON CONFLICT(prize_id, venue_id) DO UPDATE SET
              total_winners = excluded.total_winners,
              updated_at = excluded.updated_at`
          )
          .bind(id, venue.venueId, venue.totalWinners, now, now)
      )
    ]);

    const mode = normalizeMode(body.mode);
    return json({ ok: true, data: await getAdminSummary(db, mode) });
  } catch (error) {
    return errorResponse(error);
  }
}
