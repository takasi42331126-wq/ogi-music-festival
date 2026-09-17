import {
  errorResponse,
  getAdminSummary,
  getDb,
  HttpError,
  json,
  normalizeBoolean,
  normalizeMode,
  readJson,
  requireAdmin,
  nowIso
} from "../../../_lib/checkin.js";

export async function onRequestPost(context) {
  try {
    requireAdmin(context.request, context.env);
    const db = getDb(context.env);
    const body = await readJson(context.request);
    const anonymousId = typeof body.anonymousId === "string" ? body.anonymousId.trim() : "";
    const mode = normalizeMode(body.mode);

    if (!anonymousId) {
      throw new HttpError(400, "抽選番号を指定してください。");
    }

    const claimedAt = normalizeBoolean(body.claimed) ? nowIso() : null;
    const result = await db
      .prepare(
        `UPDATE draw_results
        SET claimed_at = ?
        WHERE anonymous_id = ? AND mode = ? AND result = 'win'`
      )
      .bind(claimedAt, anonymousId, mode)
      .run();

    if (Number(result?.meta?.changes ?? 0) === 0) {
      throw new HttpError(404, "当選者が見つかりません。");
    }

    return json({ ok: true, data: await getAdminSummary(db, mode) });
  } catch (error) {
    return errorResponse(error);
  }
}
