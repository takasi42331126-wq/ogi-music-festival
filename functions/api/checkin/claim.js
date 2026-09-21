import {
  errorResponse,
  getDb,
  getResult,
  HttpError,
  json,
  normalizeMode,
  normalizeVenueId,
  nowIso,
  readJson
} from "../../_lib/checkin.js";

export async function onRequestPost(context) {
  try {
    const db = getDb(context.env);
    const body = await readJson(context.request);
    const anonymousId = typeof body.anonymousId === "string" ? body.anonymousId.trim() : "";
    const venueId = normalizeVenueId(body.venueId);
    const mode = normalizeMode(body.mode);

    if (!/^A-[A-Z0-9]{6,24}$/.test(anonymousId)) {
      throw new HttpError(400, "抽選番号が正しくありません。");
    }

    const result = await db
      .prepare(
        `UPDATE draw_results
        SET claimed_at = ?
        WHERE anonymous_id = ? AND venue_id = ? AND mode = ? AND result = 'win' AND claimed_at IS NULL`
      )
      .bind(nowIso(), anonymousId, venueId, mode)
      .run();

    if (Number(result?.meta?.changes ?? 0) === 0) {
      const existing = await getResult(db, anonymousId, venueId, mode);
      if (!existing || existing.result !== "win") {
        throw new HttpError(404, "当選情報が見つかりません。");
      }
    }

    return json({ ok: true, result: await getResult(db, anonymousId, venueId, mode) });
  } catch (error) {
    return errorResponse(error);
  }
}
