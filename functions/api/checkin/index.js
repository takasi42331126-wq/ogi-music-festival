import { createCheckin, errorResponse, getDb, json, readJson } from "../../_lib/checkin.js";

export async function onRequestPost(context) {
  try {
    const db = getDb(context.env);
    const body = await readJson(context.request);
    const result = await createCheckin(db, context.request, body);
    return json({ ok: true, result });
  } catch (error) {
    return errorResponse(error);
  }
}
