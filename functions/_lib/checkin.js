import { CHECKIN_VENUES } from "../../src/data/checkinVenues.js";

const ADMIN_TOKEN_NAME = "CHECKIN_ADMIN_TOKEN";
const DB_BINDING_NAME = "CHECKIN_DB";

export { CHECKIN_VENUES };

const VENUE_MAP = new Map(CHECKIN_VENUES.map((venue) => [venue.id, venue]));
const VENUE_SELECT_SQL = CHECKIN_VENUES
  .map((venue, index) => `${index === 0 ? "SELECT" : "UNION ALL SELECT"} '${venue.id.replaceAll("'", "''")}' AS venue_id`)
  .join("\n");

export class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

export function json(data, status = 200) {
  return Response.json(data, {
    status,
    headers: {
      "Cache-Control": "no-store"
    }
  });
}

export function errorResponse(error) {
  if (error instanceof HttpError) {
    return json({ ok: false, error: error.message }, error.status);
  }

  console.error(error);
  return json({ ok: false, error: "処理中にエラーが発生しました。" }, 500);
}

export function getDb(env) {
  const db = env?.[DB_BINDING_NAME];
  if (!db) {
    throw new HttpError(500, `Cloudflare D1 binding '${DB_BINDING_NAME}' が設定されていません。`);
  }
  return db;
}

export async function readJson(request) {
  try {
    return await request.json();
  } catch {
    throw new HttpError(400, "JSON形式のリクエストを送信してください。");
  }
}

export function requireAdmin(request, env) {
  const expected = env?.[ADMIN_TOKEN_NAME];
  if (!expected) {
    throw new HttpError(500, `管理者トークン '${ADMIN_TOKEN_NAME}' が設定されていません。`);
  }

  const header = request.headers.get("Authorization") ?? "";
  const token = header.startsWith("Bearer ") ? header.slice(7).trim() : "";
  if (!token || token !== expected) {
    throw new HttpError(401, "管理者認証が必要です。");
  }
}

export function normalizeMode(value) {
  return value === "test" ? "test" : "live";
}

export function normalizeVenueId(value) {
  const venueId = typeof value === "string" ? value.trim() : "";
  if (!venueId) {
    throw new HttpError(400, "会場URLが正しくありません。会場のQRコードからアクセスしてください。");
  }
  if (!VENUE_MAP.has(venueId)) {
    throw new HttpError(400, "指定された会場は利用できません。会場のQRコードを確認してください。");
  }
  return venueId;
}

export function getVenueLabel(venueId) {
  return VENUE_MAP.get(venueId)?.label ?? venueId;
}

function checkinUrlForVenue(venueId) {
  return `/checkin?venue=${encodeURIComponent(venueId)}`;
}

export function normalizeVisitorCount(value) {
  const count = Number.parseInt(String(value), 10);
  if (!Number.isInteger(count) || count < 1 || count > 99) {
    throw new HttpError(400, "来場人数は1〜99名で指定してください。");
  }
  return count;
}

export function normalizeAnonymousId(value) {
  const id = typeof value === "string" ? value.trim().toUpperCase() : "";
  if (!id) {
    return null;
  }
  if (!/^A-[A-Z0-9]{6,24}$/.test(id)) {
    throw new HttpError(400, "匿名チェックインIDが不正です。");
  }
  return id;
}

export function normalizeBoolean(value) {
  return value === true || value === 1 || value === "1" || value === "true";
}

export function normalizePrizeName(value) {
  const name = typeof value === "string" ? value.trim() : "";
  if (!name || name.length > 80) {
    throw new HttpError(400, "景品名は1〜80文字で入力してください。");
  }
  return name;
}

export function normalizeTotalWinners(value) {
  const count = Number.parseInt(String(value), 10);
  if (!Number.isInteger(count) || count < 0 || count > 100000) {
    throw new HttpError(400, "当選本数は0〜100000の整数で指定してください。");
  }
  return count;
}

export function normalizeVenueLimits(value, fallbackTotalWinners = 0) {
  const fallback = normalizeTotalWinners(fallbackTotalWinners);
  const rawLimits = new Map();

  if (Array.isArray(value)) {
    for (const item of value) {
      const venueId = typeof item?.venueId === "string" ? item.venueId : item?.venue_id;
      if (typeof venueId === "string") {
        rawLimits.set(venueId, item.totalWinners ?? item.total_winners);
      }
    }
  } else if (value && typeof value === "object") {
    for (const [venueId, totalWinners] of Object.entries(value)) {
      rawLimits.set(venueId, totalWinners);
    }
  }

  for (const venueId of rawLimits.keys()) {
    if (!VENUE_MAP.has(venueId)) {
      throw new HttpError(400, "指定された会場別当選本数に不正な会場が含まれています。");
    }
  }

  return CHECKIN_VENUES.map((venue) => ({
    venueId: venue.id,
    totalWinners: normalizeTotalWinners(rawLimits.has(venue.id) ? rawLimits.get(venue.id) : fallback)
  }));
}

export function sumVenueLimits(venueLimits) {
  return venueLimits.reduce((sum, venue) => sum + Number(venue.totalWinners ?? 0), 0);
}

export function normalizeSortOrder(value) {
  const order = Number.parseInt(String(value ?? 0), 10);
  return Number.isInteger(order) ? order : 0;
}

export function normalizeWinRate(value) {
  const rate = Number.parseFloat(String(value));
  if (!Number.isFinite(rate) || rate < 0 || rate > 100) {
    throw new HttpError(400, "当選確率は0〜100の数値で指定してください。");
  }
  return String(Math.round(rate * 100) / 100);
}

export function nowIso() {
  return new Date().toISOString();
}

export function randomId(prefix = "id") {
  const bytes = new Uint8Array(12);
  crypto.getRandomValues(bytes);
  const token = Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
  return `${prefix}_${token}`;
}

export function anonymousId() {
  const bytes = new Uint8Array(4);
  crypto.getRandomValues(bytes);
  const value = Array.from(bytes, (byte) => byte.toString(36).padStart(2, "0"))
    .join("")
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "")
    .slice(0, 6);
  return `A-${value}`;
}

export async function userAgentHash(request) {
  const userAgent = request.headers.get("User-Agent") ?? "";
  const ipHint = request.headers.get("CF-Connecting-IP") ?? "";
  const payload = `${userAgent}|${ipHint}`;
  const data = new TextEncoder().encode(payload);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

export async function getSettings(db, mode = "live") {
  const rows = await db.prepare("SELECT key, value FROM settings WHERE mode = ?").bind(mode).all();
  const settings = Object.fromEntries((rows.results ?? []).map((row) => [row.key, row.value]));
  return {
    drawOpen: settings.draw_open !== "false",
    winRatePercent: Number.parseFloat(settings.win_rate_percent ?? "0") || 0
  };
}

export async function ensurePrizeVenueLimits(db) {
  const now = nowIso();
  await db.batch([
    db.prepare(
      `CREATE TABLE IF NOT EXISTS prize_venue_limits (
        prize_id TEXT NOT NULL,
        venue_id TEXT NOT NULL,
        total_winners INTEGER NOT NULL DEFAULT 0 CHECK (total_winners >= 0),
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (prize_id, venue_id),
        FOREIGN KEY (prize_id) REFERENCES prizes (id)
      )`
    ),
    db.prepare(
      `CREATE INDEX IF NOT EXISTS idx_prize_venue_limits_venue
        ON prize_venue_limits (venue_id)`
    ),
    db
      .prepare(
        `INSERT OR IGNORE INTO prize_venue_limits
          (prize_id, venue_id, total_winners, created_at, updated_at)
        SELECT p.id, venues.venue_id, p.total_winners, ?, ?
        FROM prizes p
        CROSS JOIN (
          ${VENUE_SELECT_SQL}
        ) venues`
      )
      .bind(now, now)
  ]);
}

export async function getResult(db, anonymousIdValue, venueId, mode) {
  return db
    .prepare(
      `SELECT
        c.anonymous_id,
        c.visitor_count,
        c.venue_id,
        c.checked_in_at,
        c.mode,
        d.id AS draw_result_id,
        d.result,
        d.drawn_at,
        d.claimed_at,
        p.id AS prize_id,
        p.name AS prize_name
      FROM checkins c
      LEFT JOIN draw_results d
        ON d.checkin_id = c.id
      LEFT JOIN prizes p
        ON p.id = d.prize_id
      WHERE c.anonymous_id = ? AND c.venue_id = ? AND c.mode = ?
      LIMIT 1`
    )
    .bind(anonymousIdValue, venueId, mode)
    .first();
}

async function availablePrizes(db, mode, venueId) {
  const rows = await db
    .prepare(
      `SELECT *
      FROM (
        SELECT
          p.id,
          p.name,
          l.total_winners,
          p.enabled,
          p.sort_order,
          l.total_winners - COALESCE(w.win_count, 0) AS remaining
        FROM prizes p
        JOIN prize_venue_limits l
          ON l.prize_id = p.id AND l.venue_id = ?
        LEFT JOIN (
          SELECT prize_id, COUNT(*) AS win_count
          FROM draw_results
          WHERE result = 'win' AND mode = ? AND venue_id = ?
          GROUP BY prize_id
        ) w ON w.prize_id = p.id
        WHERE p.enabled = 1 AND l.total_winners > 0
      )
      WHERE remaining > 0
      ORDER BY sort_order ASC, name ASC`
    )
    .bind(venueId, mode, venueId)
    .all();

  return rows.results ?? [];
}

function pickWeightedPrize(prizes) {
  const total = prizes.reduce((sum, prize) => sum + Number(prize.remaining ?? 0), 0);
  if (total <= 0) {
    return null;
  }

  let target = Math.random() * total;
  for (const prize of prizes) {
    target -= Number(prize.remaining ?? 0);
    if (target <= 0) {
      return prize;
    }
  }
  return prizes[prizes.length - 1] ?? null;
}

async function insertLose(db, anonymousIdValue, checkinId, venueId, mode, drawnAt) {
  await db
    .prepare(
      `INSERT OR IGNORE INTO draw_results
        (id, anonymous_id, checkin_id, venue_id, prize_id, result, mode, drawn_at)
      VALUES (?, ?, ?, ?, NULL, 'lose', ?, ?)`
    )
    .bind(randomId("draw"), anonymousIdValue, checkinId, venueId, mode, drawnAt)
    .run();
}

async function insertWinIfRemaining(db, anonymousIdValue, checkinId, venueId, mode, drawnAt, prizeId) {
  const result = await db
    .prepare(
      `INSERT OR IGNORE INTO draw_results
        (id, anonymous_id, checkin_id, venue_id, prize_id, result, mode, drawn_at)
      SELECT ?, ?, ?, ?, p.id, 'win', ?, ?
      FROM prizes p
      JOIN prize_venue_limits l
        ON l.prize_id = p.id
      WHERE p.id = ?
        AND p.enabled = 1
        AND l.venue_id = ?
        AND l.total_winners > (
          SELECT COUNT(*)
          FROM draw_results
          WHERE prize_id = p.id AND result = 'win' AND mode = ? AND venue_id = ?
        )`
    )
    .bind(randomId("draw"), anonymousIdValue, checkinId, venueId, mode, drawnAt, prizeId, venueId, mode, venueId)
    .run();

  return Number(result?.meta?.changes ?? 0) === 1;
}

async function drawForCheckin(db, anonymousIdValue, checkinId, venueId, mode) {
  const drawnAt = nowIso();
  const settings = await getSettings(db, mode);

  if (!settings.drawOpen || settings.winRatePercent <= 0 || Math.random() * 100 >= settings.winRatePercent) {
    await insertLose(db, anonymousIdValue, checkinId, venueId, mode, drawnAt);
    return getResult(db, anonymousIdValue, venueId, mode);
  }

  await ensurePrizeVenueLimits(db);
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const prizes = await availablePrizes(db, mode, venueId);
    const prize = pickWeightedPrize(prizes);
    if (!prize) {
      break;
    }

    if (await insertWinIfRemaining(db, anonymousIdValue, checkinId, venueId, mode, drawnAt, prize.id)) {
      return getResult(db, anonymousIdValue, venueId, mode);
    }
  }

  await insertLose(db, anonymousIdValue, checkinId, venueId, mode, drawnAt);
  return getResult(db, anonymousIdValue, venueId, mode);
}

export async function createCheckin(db, request, body) {
  const visitorCount = normalizeVisitorCount(body.visitorCount);
  const mode = normalizeMode(body.mode);
  const venueId = normalizeVenueId(body.venueId);
  const providedAnonymousId = normalizeAnonymousId(body.anonymousId);
  const hash = await userAgentHash(request);
  const checkedInAt = nowIso();

  for (let attempt = 0; attempt < 8; attempt += 1) {
    const id = randomId("checkin");
    const generatedAnonymousId = providedAnonymousId ?? anonymousId();
    try {
      await db
        .prepare(
          `INSERT INTO checkins
            (id, anonymous_id, venue_id, visitor_count, mode, user_agent_hash, checked_in_at)
          VALUES (?, ?, ?, ?, ?, ?, ?)`
        )
        .bind(id, generatedAnonymousId, venueId, visitorCount, mode, hash, checkedInAt)
        .run();

      return drawForCheckin(db, generatedAnonymousId, id, venueId, mode);
    } catch (error) {
      if (String(error?.message ?? "").includes("UNIQUE")) {
        if (providedAnonymousId) {
          const existing = await getResult(db, generatedAnonymousId, venueId, mode);
          if (existing) {
            return existing;
          }
        }
        continue;
      }
      throw error;
    }
  }

  throw new HttpError(500, "匿名チェックインIDを発行できませんでした。");
}

export async function getAdminSummary(db, mode) {
  await ensurePrizeVenueLimits(db);

  const [stats, prizeRows, prizeVenueRows, winnerRows, venueRows, settingsRows] = await Promise.all([
    db
      .prepare(
        `SELECT
          COUNT(*) AS checkin_count,
          COALESCE(SUM(visitor_count), 0) AS visitor_total
        FROM checkins
        WHERE mode = ?`
      )
      .bind(mode)
      .first(),
    db
      .prepare(
        `SELECT
          p.id,
          p.name,
          COALESCE(SUM(l.total_winners), p.total_winners, 0) AS total_winners,
          p.enabled,
          p.sort_order,
          p.created_at,
          p.updated_at,
          COALESCE(SUM(w.win_count), 0) AS win_count,
          COALESCE(SUM(w.claimed_count), 0) AS claimed_count,
          COALESCE(SUM(
            CASE
              WHEN l.total_winners - COALESCE(w.win_count, 0) > 0
              THEN l.total_winners - COALESCE(w.win_count, 0)
              ELSE 0
            END
          ), 0) AS remaining_count
        FROM prizes p
        LEFT JOIN prize_venue_limits l
          ON l.prize_id = p.id
        LEFT JOIN (
          SELECT
            prize_id,
            venue_id,
            COUNT(*) AS win_count,
            SUM(CASE WHEN claimed_at IS NOT NULL THEN 1 ELSE 0 END) AS claimed_count
          FROM draw_results
          WHERE result = 'win' AND mode = ?
          GROUP BY prize_id, venue_id
        ) w ON w.prize_id = p.id AND w.venue_id = l.venue_id
        GROUP BY p.id
        ORDER BY p.sort_order ASC, p.name ASC`
      )
      .bind(mode)
      .all(),
    db
      .prepare(
        `SELECT
          p.id AS prize_id,
          venues.venue_id,
          COALESCE(l.total_winners, 0) AS total_winners,
          COALESCE(w.win_count, 0) AS win_count,
          COALESCE(w.claimed_count, 0) AS claimed_count,
          CASE
            WHEN COALESCE(l.total_winners, 0) - COALESCE(w.win_count, 0) > 0
            THEN COALESCE(l.total_winners, 0) - COALESCE(w.win_count, 0)
            ELSE 0
          END AS remaining_count
        FROM prizes p
        CROSS JOIN (
          ${VENUE_SELECT_SQL}
        ) venues
        LEFT JOIN prize_venue_limits l
          ON l.prize_id = p.id AND l.venue_id = venues.venue_id
        LEFT JOIN (
          SELECT
            prize_id,
            venue_id,
            COUNT(*) AS win_count,
            SUM(CASE WHEN claimed_at IS NOT NULL THEN 1 ELSE 0 END) AS claimed_count
          FROM draw_results
          WHERE result = 'win' AND mode = ?
          GROUP BY prize_id, venue_id
        ) w ON w.prize_id = p.id AND w.venue_id = venues.venue_id
        ORDER BY p.sort_order ASC, p.name ASC, venues.venue_id ASC`
      )
      .bind(mode)
      .all(),
    db
      .prepare(
        `SELECT
          d.id,
          d.anonymous_id,
          d.drawn_at,
          d.claimed_at,
          p.name AS prize_name,
          c.visitor_count,
          d.venue_id
        FROM draw_results d
        JOIN prizes p ON p.id = d.prize_id
        LEFT JOIN checkins c ON c.id = d.checkin_id
        WHERE d.result = 'win' AND d.mode = ?
        ORDER BY d.drawn_at DESC
        LIMIT 500`
      )
      .bind(mode)
      .all(),
    db
      .prepare(
        `SELECT
          venue_id,
          COUNT(*) AS checkin_count,
          COALESCE(SUM(visitor_count), 0) AS visitor_total
        FROM checkins
        WHERE mode = ?
        GROUP BY venue_id
        ORDER BY visitor_total DESC, venue_id ASC`
      )
      .bind(mode)
      .all(),
    db.prepare("SELECT key, value FROM settings WHERE mode = ? ORDER BY key ASC").bind(mode).all()
  ]);

  const rawVenueStats = new Map(
    (venueRows.results ?? []).map((venue) => [
      venue.venue_id,
      {
        ...venue,
        checkin_count: Number(venue.checkin_count ?? 0),
        visitor_total: Number(venue.visitor_total ?? 0)
      }
    ])
  );
  const knownVenueStats = CHECKIN_VENUES.map((venue) => {
    const stats = rawVenueStats.get(venue.id);
    rawVenueStats.delete(venue.id);
    return {
      venue_id: venue.id,
      venue_name: venue.label,
      checkin_count: stats?.checkin_count ?? 0,
      visitor_total: stats?.visitor_total ?? 0,
      checkin_url: checkinUrlForVenue(venue.id)
    };
  });
  const unknownVenueStats = [...rawVenueStats.values()].map((venue) => ({
    ...venue,
    venue_name: getVenueLabel(venue.venue_id),
    checkin_url: null
  }));
  const venueStats = [...knownVenueStats, ...unknownVenueStats];
  const venueTotal = venueStats.reduce(
    (total, venue) => ({
      checkinCount: total.checkinCount + Number(venue.checkin_count ?? 0),
      visitorTotal: total.visitorTotal + Number(venue.visitor_total ?? 0)
    }),
    { checkinCount: 0, visitorTotal: 0 }
  );

  const prizeVenueLimits = new Map();
  for (const row of prizeVenueRows.results ?? []) {
    const limits = prizeVenueLimits.get(row.prize_id) ?? [];
    limits.push({
      venue_id: row.venue_id,
      venue_name: getVenueLabel(row.venue_id),
      total_winners: Number(row.total_winners ?? 0),
      win_count: Number(row.win_count ?? 0),
      claimed_count: Number(row.claimed_count ?? 0),
      remaining_count: Number(row.remaining_count ?? 0)
    });
    prizeVenueLimits.set(row.prize_id, limits);
  }

  return {
    mode,
    stats: {
      checkinCount: Number(stats?.checkin_count ?? 0),
      visitorTotal: Number(stats?.visitor_total ?? 0)
    },
    prizes: (prizeRows.results ?? []).map((prize) => ({
      ...prize,
      enabled: Boolean(prize.enabled),
      total_winners: Number(prize.total_winners ?? 0),
      win_count: Number(prize.win_count ?? 0),
      claimed_count: Number(prize.claimed_count ?? 0),
      remaining_count: Number(prize.remaining_count ?? 0),
      venue_limits: prizeVenueLimits.get(prize.id) ?? []
    })),
    winners: winnerRows.results ?? [],
    venueStats,
    venueTotal,
    settings: Object.fromEntries((settingsRows.results ?? []).map((row) => [row.key, row.value]))
  };
}
