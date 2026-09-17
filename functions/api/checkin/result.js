import { errorResponse, getDb, getResult, HttpError, json, normalizeMode, normalizeVenueId } from "../../_lib/checkin.js";

export async function onRequestGet(context) {
  try {
    const db = getDb(context.env);
    const url = new URL(context.request.url);
    const anonymousId = (url.searchParams.get("anonymousId") ?? "").trim();
    const venueId = normalizeVenueId(url.searchParams.get("venue") ?? url.searchParams.get("venueId"));
    const mode = normalizeMode(url.searchParams.get("mode"));

    if (!anonymousId) {
      throw new HttpError(400, "匿名チェックインIDを指定してください。");
    }

    const result = await getResult(db, anonymousId, venueId, mode);
    if (!result) {
      throw new HttpError(404, "チェックイン情報が見つかりません。");
    }

    return json({ ok: true, result });
  } catch (error) {
    return errorResponse(error);
  }
}
