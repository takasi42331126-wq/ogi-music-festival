import { errorResponse, getDb, getResult, HttpError, json, normalizeMode } from "../../_lib/checkin.js";

export async function onRequestGet(context) {
  try {
    const db = getDb(context.env);
    const url = new URL(context.request.url);
    const anonymousId = (url.searchParams.get("anonymousId") ?? "").trim();
    const mode = normalizeMode(url.searchParams.get("mode"));

    if (!anonymousId) {
      throw new HttpError(400, "匿名チェックインIDを指定してください。");
    }

    const result = await getResult(db, anonymousId, mode);
    if (!result) {
      throw new HttpError(404, "チェックイン情報が見つかりません。");
    }

    return json({ ok: true, result });
  } catch (error) {
    return errorResponse(error);
  }
}
