import { errorResponse, getAdminSummary, getDb, json, normalizeMode, requireAdmin } from "../../../_lib/checkin.js";

export async function onRequestGet(context) {
  try {
    requireAdmin(context.request, context.env);
    const db = getDb(context.env);
    const url = new URL(context.request.url);
    const mode = normalizeMode(url.searchParams.get("mode"));
    return json({ ok: true, data: await getAdminSummary(db, mode) });
  } catch (error) {
    return errorResponse(error);
  }
}
