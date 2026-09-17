import { errorResponse, getAdminSummary, getDb, HttpError, json, readJson, requireAdmin } from "../../../_lib/checkin.js";

export async function onRequestPost(context) {
  try {
    requireAdmin(context.request, context.env);
    const db = getDb(context.env);
    const body = await readJson(context.request);

    if (body.confirm !== "DELETE TEST DATA") {
      throw new HttpError(400, "テストデータ削除には確認文字列が必要です。");
    }

    await db.batch([
      db.prepare("DELETE FROM draw_results WHERE mode = 'test'"),
      db.prepare("DELETE FROM checkins WHERE mode = 'test'")
    ]);

    return json({ ok: true, data: await getAdminSummary(db, "test") });
  } catch (error) {
    return errorResponse(error);
  }
}
