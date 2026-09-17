import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import { createCheckin, getAdminSummary, getResult } from "../functions/_lib/checkin.js";
import { onRequest as guardAdminPage } from "../functions/admin/checkin/_middleware.js";
import { onRequestPost as claimPrize } from "../functions/api/checkin/admin/claim.js";
import { onRequestPost as savePrize } from "../functions/api/checkin/admin/prizes.js";
import { onRequestPost as saveSettings } from "../functions/api/checkin/admin/settings.js";
import { CHECKIN_VENUES } from "../src/data/checkinVenues.js";

const ADMIN_TOKEN = "test-admin-token";

class MockD1Statement {
  constructor(db, sql, args = []) {
    this.db = db;
    this.sql = sql.replace(/\s+/g, " ").trim();
    this.args = args;
  }

  bind(...args) {
    return new MockD1Statement(this.db, this.sql, args);
  }

  run() {
    return this.db.run(this.sql, this.args);
  }

  first() {
    return this.db.first(this.sql, this.args);
  }

  all() {
    return this.db.all(this.sql, this.args);
  }
}

class MockD1 {
  constructor() {
    this.checkins = [];
    this.drawResults = [];
    this.prizes = [];
    this.prizeVenueLimits = [];
    this.settings = new Map([
      ["live:draw_open", "true"],
      ["live:win_rate_percent", "0"],
      ["test:draw_open", "true"],
      ["test:win_rate_percent", "0"]
    ]);
  }

  prepare(sql) {
    return new MockD1Statement(this, sql);
  }

  async batch(statements) {
    const results = [];
    for (const statement of statements) {
      results.push(await statement.run());
    }
    return results;
  }

  addPrize({ id, name, totalWinners, venueLimits, enabled = 1, sortOrder = 0 }) {
    const now = new Date().toISOString();
    const limits = CHECKIN_VENUES.map((venue) => ({
      prize_id: id,
      venue_id: venue.id,
      total_winners: Number(venueLimits?.[venue.id] ?? totalWinners ?? 0),
      created_at: now,
      updated_at: now
    }));
    this.prizes.push({
      id,
      name,
      total_winners: limits.reduce((sum, item) => sum + item.total_winners, 0),
      enabled,
      sort_order: sortOrder,
      created_at: now,
      updated_at: now
    });
    this.prizeVenueLimits.push(...limits);
  }

  setPrizeTotal(id, totalWinners) {
    const prize = this.prizes.find((item) => item.id === id);
    assert.ok(prize, `Prize ${id} exists`);
    for (const venue of CHECKIN_VENUES) {
      this.upsertPrizeVenueLimit(id, venue.id, totalWinners);
    }
    prize.total_winners = totalWinners * CHECKIN_VENUES.length;
    prize.updated_at = new Date().toISOString();
  }

  upsertPrizeVenueLimit(prizeId, venueId, totalWinners) {
    const now = new Date().toISOString();
    const existing = this.prizeVenueLimits.find((item) => item.prize_id === prizeId && item.venue_id === venueId);
    if (existing) {
      existing.total_winners = Number(totalWinners);
      existing.updated_at = now;
      return existing;
    }
    const created = {
      prize_id: prizeId,
      venue_id: venueId,
      total_winners: Number(totalWinners),
      created_at: now,
      updated_at: now
    };
    this.prizeVenueLimits.push(created);
    return created;
  }

  seedMissingPrizeVenueLimits() {
    for (const prize of this.prizes) {
      for (const venue of CHECKIN_VENUES) {
        if (!this.prizeVenueLimits.some((item) => item.prize_id === prize.id && item.venue_id === venue.id)) {
          this.upsertPrizeVenueLimit(prize.id, venue.id, prize.total_winners);
        }
      }
    }
  }

  setSetting(mode, key, value) {
    this.settings.set(`${mode}:${key}`, String(value));
  }

  run(sql, args) {
    if (sql.startsWith("CREATE TABLE IF NOT EXISTS prize_venue_limits") || sql.startsWith("CREATE INDEX IF NOT EXISTS idx_prize_venue_limits_venue")) {
      return { meta: { changes: 0 } };
    }

    if (sql.startsWith("INSERT OR IGNORE INTO prize_venue_limits")) {
      const before = this.prizeVenueLimits.length;
      this.seedMissingPrizeVenueLimits();
      return { meta: { changes: this.prizeVenueLimits.length - before } };
    }

    if (sql.startsWith("INSERT INTO checkins")) {
      const [id, anonymousId, venueId, visitorCount, mode, userAgentHash, checkedInAt] = args;
      if (this.checkins.some((item) => item.anonymous_id === anonymousId && item.venue_id === venueId && item.mode === mode)) {
        throw new Error("UNIQUE constraint failed: checkins.anonymous_id, checkins.venue_id, checkins.mode");
      }
      this.checkins.push({
        id,
        anonymous_id: anonymousId,
        venue_id: venueId,
        visitor_count: visitorCount,
        mode,
        user_agent_hash: userAgentHash,
        checked_in_at: checkedInAt,
        created_at: checkedInAt
      });
      return { meta: { changes: 1 } };
    }

    if (sql.startsWith("INSERT OR IGNORE INTO draw_results") && sql.includes("SELECT")) {
      const [id, anonymousId, checkinId, venueId, mode, drawnAt, prizeId, limitVenueId, countMode, countVenueId] = args;
      if (this.drawResults.some((item) => item.anonymous_id === anonymousId && item.venue_id === venueId && item.mode === mode)) {
        return { meta: { changes: 0 } };
      }
      const prize = this.prizes.find((item) => item.id === prizeId);
      const venueLimit = this.prizeVenueLimits.find((item) => item.prize_id === prizeId && item.venue_id === limitVenueId);
      const winCount = this.drawResults.filter(
        (item) => item.prize_id === prizeId && item.result === "win" && item.mode === countMode && item.venue_id === countVenueId
      ).length;
      if (!prize || !venueLimit || prize.enabled !== 1 || venueLimit.total_winners <= winCount) {
        return { meta: { changes: 0 } };
      }
      this.drawResults.push({
        id,
        anonymous_id: anonymousId,
        checkin_id: checkinId,
        venue_id: venueId,
        prize_id: prizeId,
        result: "win",
        mode,
        drawn_at: drawnAt,
        claimed_at: null,
        created_at: drawnAt
      });
      return { meta: { changes: 1 } };
    }

    if (sql.startsWith("INSERT OR IGNORE INTO draw_results")) {
      const [id, anonymousId, checkinId, venueId, mode, drawnAt] = args;
      if (this.drawResults.some((item) => item.anonymous_id === anonymousId && item.venue_id === venueId && item.mode === mode)) {
        return { meta: { changes: 0 } };
      }
      this.drawResults.push({
        id,
        anonymous_id: anonymousId,
        checkin_id: checkinId,
        venue_id: venueId,
        prize_id: null,
        result: "lose",
        mode,
        drawn_at: drawnAt,
        claimed_at: null,
        created_at: drawnAt
      });
      return { meta: { changes: 1 } };
    }

    if (sql.startsWith("UPDATE draw_results SET claimed_at")) {
      const [claimedAt, anonymousId, venueId, mode] = args;
      const result = this.drawResults.find(
        (item) => item.anonymous_id === anonymousId && item.venue_id === venueId && item.mode === mode && item.result === "win"
      );
      if (!result) {
        return { meta: { changes: 0 } };
      }
      result.claimed_at = claimedAt;
      return { meta: { changes: 1 } };
    }

    if (sql.startsWith("INSERT INTO prizes")) {
      const [id, name, totalWinners, enabled, sortOrder, createdAt, updatedAt] = args;
      const existing = this.prizes.find((item) => item.id === id);
      if (existing) {
        existing.name = name;
        existing.total_winners = totalWinners;
        existing.enabled = enabled;
        existing.sort_order = sortOrder;
        existing.updated_at = updatedAt;
      } else {
        this.prizes.push({
          id,
          name,
          total_winners: totalWinners,
          enabled,
          sort_order: sortOrder,
          created_at: createdAt,
          updated_at: updatedAt
        });
      }
      return { meta: { changes: 1 } };
    }

    if (sql.startsWith("INSERT INTO prize_venue_limits")) {
      const [prizeId, venueId, totalWinners] = args;
      this.upsertPrizeVenueLimit(prizeId, venueId, totalWinners);
      return { meta: { changes: 1 } };
    }

    if (sql.startsWith("INSERT INTO settings")) {
      const [mode, value] = args.length === 3 ? args : [args[0], args[1]];
      const key = sql.includes("'win_rate_percent'") ? "win_rate_percent" : "draw_open";
      this.settings.set(`${mode}:${key}`, String(value));
      return { meta: { changes: 1 } };
    }

    throw new Error(`Unsupported run SQL: ${sql}`);
  }

  first(sql, args) {
    if (sql.includes("FROM checkins c LEFT JOIN draw_results")) {
      const [anonymousId, venueId, mode] = args;
      return this.rowForResult(anonymousId, venueId, mode) ?? null;
    }

    if (sql.includes("COUNT(*) AS checkin_count") && sql.includes("FROM checkins") && !sql.includes("GROUP BY")) {
      const [mode] = args;
      const checkins = this.checkins.filter((item) => item.mode === mode);
      return {
        checkin_count: checkins.length,
        visitor_total: checkins.reduce((sum, item) => sum + Number(item.visitor_count), 0)
      };
    }

    throw new Error(`Unsupported first SQL: ${sql}`);
  }

  all(sql, args) {
    if (sql === "SELECT key, value FROM settings WHERE mode = ?") {
      const [mode] = args;
      return {
        results: [
          { key: "draw_open", value: this.settings.get(`${mode}:draw_open`) ?? "true" },
          { key: "win_rate_percent", value: this.settings.get(`${mode}:win_rate_percent`) ?? "0" }
        ]
      };
    }

    if (sql === "SELECT key, value FROM settings WHERE mode = ? ORDER BY key ASC") {
      const [mode] = args;
      return {
        results: [
          { key: "draw_open", value: this.settings.get(`${mode}:draw_open`) ?? "true" },
          { key: "win_rate_percent", value: this.settings.get(`${mode}:win_rate_percent`) ?? "0" }
        ].sort((left, right) => left.key.localeCompare(right.key))
      };
    }

    if (sql.includes("FROM prizes p") && sql.includes("WHERE remaining > 0")) {
      const [venueId, mode] = args;
      return { results: this.availablePrizes(mode, venueId) };
    }

    if (sql.includes("p.id AS prize_id") && sql.includes("venues.venue_id")) {
      const [mode] = args;
      return { results: this.prizeVenueSummary(mode) };
    }

    if (sql.includes("COALESCE(SUM(w.claimed_count), 0) AS claimed_count")) {
      const [mode] = args;
      return { results: this.prizeSummary(mode) };
    }

    if (sql.includes("FROM draw_results d JOIN prizes p")) {
      const [mode] = args;
      return { results: this.winners(mode) };
    }

    if (sql.includes("GROUP BY venue_id")) {
      const [mode] = args;
      return { results: this.venueStats(mode) };
    }

    throw new Error(`Unsupported all SQL: ${sql}`);
  }

  availablePrizes(mode, venueId) {
    return this.prizeVenueSummary(mode)
      .filter((prize) => prize.venue_id === venueId && prize.enabled === 1 && prize.total_winners > 0 && prize.remaining > 0)
      .map((prize) => ({ ...prize }))
      .sort((left, right) => left.sort_order - right.sort_order || left.name.localeCompare(right.name));
  }

  prizeSummary(mode) {
    return this.prizes
      .map((prize) => {
        const wins = this.drawResults.filter(
          (result) => result.mode === mode && result.prize_id === prize.id && result.result === "win"
        );
        const winCount = wins.length;
        const claimedCount = wins.filter((result) => result.claimed_at).length;
        const limits = this.prizeVenueLimits.filter((limit) => limit.prize_id === prize.id);
        const totalWinners = limits.reduce((sum, limit) => sum + Number(limit.total_winners), 0);
        const remaining = limits.reduce((sum, limit) => {
          const venueWinCount = wins.filter((result) => result.venue_id === limit.venue_id).length;
          return sum + Math.max(Number(limit.total_winners) - venueWinCount, 0);
        }, 0);
        return {
          ...prize,
          total_winners: totalWinners,
          win_count: winCount,
          claimed_count: claimedCount,
          remaining,
          remaining_count: remaining
        };
      })
      .sort((left, right) => left.sort_order - right.sort_order || left.name.localeCompare(right.name));
  }

  prizeVenueSummary(mode) {
    const rows = [];
    for (const prize of this.prizes) {
      for (const venue of CHECKIN_VENUES) {
        const limit = this.prizeVenueLimits.find((item) => item.prize_id === prize.id && item.venue_id === venue.id);
        const wins = this.drawResults.filter(
          (result) => result.mode === mode && result.prize_id === prize.id && result.venue_id === venue.id && result.result === "win"
        );
        const winCount = wins.length;
        const totalWinners = Number(limit?.total_winners ?? 0);
        rows.push({
          ...prize,
          prize_id: prize.id,
          venue_id: venue.id,
          total_winners: totalWinners,
          win_count: winCount,
          claimed_count: wins.filter((result) => result.claimed_at).length,
          remaining: totalWinners - winCount,
          remaining_count: Math.max(totalWinners - winCount, 0)
        });
      }
    }
    return rows.sort((left, right) => left.sort_order - right.sort_order || left.name.localeCompare(right.name) || left.venue_id.localeCompare(right.venue_id));
  }

  rowForResult(anonymousId, venueId, mode) {
    const checkin = this.checkins.find((item) => item.anonymous_id === anonymousId && item.venue_id === venueId && item.mode === mode);
    if (!checkin) {
      return null;
    }
    const draw = this.drawResults.find((item) => item.checkin_id === checkin.id);
    const prize = draw?.prize_id ? this.prizes.find((item) => item.id === draw.prize_id) : null;
    return {
      anonymous_id: checkin.anonymous_id,
      visitor_count: checkin.visitor_count,
      venue_id: checkin.venue_id,
      checked_in_at: checkin.checked_in_at,
      mode: checkin.mode,
      draw_result_id: draw?.id ?? null,
      result: draw?.result ?? null,
      drawn_at: draw?.drawn_at ?? null,
      claimed_at: draw?.claimed_at ?? null,
      prize_id: prize?.id ?? null,
      prize_name: prize?.name ?? null
    };
  }

  winners(mode) {
    return this.drawResults
      .filter((item) => item.mode === mode && item.result === "win")
      .map((item) => {
        const prize = this.prizes.find((prizeItem) => prizeItem.id === item.prize_id);
        const checkin = this.checkins.find((checkinItem) => checkinItem.id === item.checkin_id);
        return {
          id: item.id,
          anonymous_id: item.anonymous_id,
          drawn_at: item.drawn_at,
          claimed_at: item.claimed_at,
          prize_name: prize?.name ?? null,
          visitor_count: checkin?.visitor_count ?? null,
          venue_id: item.venue_id
        };
      })
      .sort((left, right) => String(right.drawn_at).localeCompare(String(left.drawn_at)))
      .slice(0, 500);
  }

  venueStats(mode) {
    const stats = new Map();
    for (const checkin of this.checkins.filter((item) => item.mode === mode)) {
      const current = stats.get(checkin.venue_id) ?? { venue_id: checkin.venue_id, checkin_count: 0, visitor_total: 0 };
      current.checkin_count += 1;
      current.visitor_total += Number(checkin.visitor_count);
      stats.set(checkin.venue_id, current);
    }
    return [...stats.values()].sort((left, right) => right.visitor_total - left.visitor_total || left.venue_id.localeCompare(right.venue_id));
  }
}

function checkinRequest(id) {
  return new Request("https://example.test/checkin", {
    headers: {
      "User-Agent": `checkin-test-${id}`,
      "CF-Connecting-IP": `203.0.113.${id % 250}`
    }
  });
}

function adminContext(db, body) {
  return {
    request: new Request("https://example.test/api/checkin/admin", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${ADMIN_TOKEN}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify(body)
    }),
    env: {
      CHECKIN_DB: db,
      CHECKIN_ADMIN_TOKEN: ADMIN_TOKEN
    }
  };
}

async function createVisitor(db, id, body = {}) {
  return createCheckin(db, checkinRequest(id), {
    visitorCount: 1,
    venueId: "park",
    mode: "live",
    ...body
  });
}

async function simulateBrowserCheckin(db, storage, requestId, body = {}) {
  const mode = body.mode ?? "live";
  const venueId = body.venueId;
  const visitorStorageKey = `ogi-dx2026-visitor:${mode}`;
  const anonymousId = storage.get(visitorStorageKey) ?? "A-BRWS01";
  storage.set(visitorStorageKey, anonymousId);
  const storageKey = `ogi-dx2026-checkin:${mode}:${venueId}`;
  const storedAnonymousId = storage.get(storageKey);
  if (storedAnonymousId) {
    return {
      submitted: false,
      result: await getResult(db, storedAnonymousId, venueId, mode)
    };
  }

  const result = await createCheckin(db, checkinRequest(requestId), {
    anonymousId,
    visitorCount: body.visitorCount,
    venueId,
    mode
  });
  storage.set(storageKey, result.anonymous_id);
  return { submitted: true, result };
}

function venueStat(summary, venueId) {
  return summary.venueStats.find((venue) => venue.venue_id === venueId);
}

function resolveVisitorCountSelection(selection, customValue = "5") {
  const isCustomCount = selection === "custom";
  const visitorCount = isCustomCount ? Number(customValue) : Number(selection);
  const minVisitorCount = isCustomCount ? 5 : 1;
  const maxVisitorCount = isCustomCount ? 99 : 4;

  if (!Number.isInteger(visitorCount) || visitorCount < minVisitorCount || visitorCount > maxVisitorCount) {
    throw new Error("invalid visitor count");
  }

  return {
    customInputVisible: isCustomCount,
    visitorCount
  };
}

function testVisitorCountSelectionRules() {
  assert.deepEqual(resolveVisitorCountSelection("1"), {
    customInputVisible: false,
    visitorCount: 1
  }, "1名選択時はvisitor_count=1になり、5名以上入力欄は非表示");
  assert.deepEqual(resolveVisitorCountSelection("2"), {
    customInputVisible: false,
    visitorCount: 2
  }, "2名選択時はvisitor_count=2になり、5名以上入力欄は非表示");
  assert.deepEqual(resolveVisitorCountSelection("3"), {
    customInputVisible: false,
    visitorCount: 3
  }, "3名選択時はvisitor_count=3になり、5名以上入力欄は非表示");
  assert.deepEqual(resolveVisitorCountSelection("4"), {
    customInputVisible: false,
    visitorCount: 4
  }, "4名選択時はvisitor_count=4になり、5名以上入力欄は非表示");
  assert.deepEqual(resolveVisitorCountSelection("custom", "5"), {
    customInputVisible: true,
    visitorCount: 5
  }, "5名以上の初期値はvisitor_count=5");
  assert.deepEqual(resolveVisitorCountSelection("custom", "99"), {
    customInputVisible: true,
    visitorCount: 99
  }, "5名以上は99名まで送信できる");

  assert.throws(() => resolveVisitorCountSelection("custom", ""), /invalid visitor count/, "5名以上で空欄は送信できない");
  assert.throws(() => resolveVisitorCountSelection("custom", "4"), /invalid visitor count/, "5名以上で5未満は送信できない");
  assert.throws(() => resolveVisitorCountSelection("custom", "100"), /invalid visitor count/, "5名以上で100以上は送信できない");
}

function venueLimits(values = {}) {
  return Object.fromEntries(CHECKIN_VENUES.map((venue) => [venue.id, values[venue.id] ?? 0]));
}

async function savePrizeTotal(db, totalWinners, limits = { park: totalWinners }) {
  const response = await savePrize(adminContext(db, {
    mode: "live",
    id: "prize-a",
    name: "本数変更景品",
    venueLimits: venueLimits(limits),
    enabled: true,
    sortOrder: 0
  }));
  assert.equal(response.status, 200, "景品設定APIが成功する");
}

function prizeVenueLimit(summary, prizeId, venueId) {
  const prize = summary.prizes.find((item) => item.id === prizeId);
  assert.ok(prize, `${prizeId}の景品集計が存在する`);
  const venue = prize.venue_limits.find((item) => item.venue_id === venueId);
  assert.ok(venue, `${venueId}の会場別当選上限が存在する`);
  return venue;
}

async function testConcurrentWinnerCap() {
  const db = new MockD1();
  db.addPrize({ id: "prize-a", name: "テスト景品", totalWinners: 3 });
  db.setSetting("live", "win_rate_percent", "100");

  const results = await Promise.all(
    Array.from({ length: 30 }, (_, index) => createVisitor(db, index + 1))
  );
  const wins = results.filter((result) => result.result === "win");
  const losses = results.filter((result) => result.result === "lose");

  assert.equal(wins.length, 3, "同時チェックインでも小城公園の会場別当選本数を超えない");
  assert.equal(losses.length, 27, "上限到達後はハズレとして確定する");
  assert.equal(db.drawResults.filter((result) => result.result === "win").length, 3);
}

async function testVenueSpecificWinnerCaps() {
  const db = new MockD1();
  db.addPrize({
    id: "prize-a",
    name: "会場別景品",
    venueLimits: {
      park: 10,
      yumeplat: 3,
      highschool: 2,
      university: 1,
      sakuraoka: 5
    }
  });
  db.setSetting("live", "win_rate_percent", "100");

  const parkResults = await Promise.all(Array.from({ length: 12 }, (_, index) => createVisitor(db, 700 + index, { venueId: "park" })));
  const sakuraokaResults = await Promise.all(Array.from({ length: 7 }, (_, index) => createVisitor(db, 800 + index, { venueId: "sakuraoka" })));
  const yumeplatResults = await Promise.all(Array.from({ length: 4 }, (_, index) => createVisitor(db, 900 + index, { venueId: "yumeplat" })));
  const highschoolResults = await Promise.all(Array.from({ length: 3 }, (_, index) => createVisitor(db, 1000 + index, { venueId: "highschool" })));
  const universityResults = await Promise.all(Array.from({ length: 2 }, (_, index) => createVisitor(db, 1100 + index, { venueId: "university" })));

  assert.equal(parkResults.filter((result) => result.result === "win").length, 10, "小城公園は10本を超えて当選しない");
  assert.equal(sakuraokaResults.filter((result) => result.result === "win").length, 5, "桜岡小学校は5本を超えて当選しない");
  assert.equal(yumeplatResults.filter((result) => result.result === "win").length, 3, "ゆめぷらっと小城は3本を超えて当選しない");
  assert.equal(highschoolResults.filter((result) => result.result === "win").length, 2, "小城高校は2本を超えて当選しない");
  assert.equal(universityResults.filter((result) => result.result === "win").length, 1, "西九州大学は1本を超えて当選しない");
  assert.equal(sakuraokaResults[0].result, "win", "小城公園が上限に達しても桜岡小学校の抽選には影響しない");

  const summary = await getAdminSummary(db, "live");
  assert.deepEqual(
    Object.fromEntries(summary.prizes[0].venue_limits.map((venue) => [venue.venue_id, venue.total_winners])),
    {
      park: 10,
      yumeplat: 3,
      highschool: 2,
      university: 1,
      sakuraoka: 5
    },
    "5会場それぞれ独立した設定当選数を管理できる"
  );
  assert.equal(prizeVenueLimit(summary, "prize-a", "park").win_count, 10, "管理画面集計で小城公園の当選済み数を確認できる");
  assert.equal(prizeVenueLimit(summary, "prize-a", "park").remaining_count, 0, "管理画面集計で小城公園の残り当選数を確認できる");
  assert.equal(prizeVenueLimit(summary, "prize-a", "sakuraoka").win_count, 5, "管理画面集計で桜岡小学校の当選済み数を確認できる");
  assert.equal(prizeVenueLimit(summary, "prize-a", "sakuraoka").remaining_count, 0, "管理画面集計で桜岡小学校の残り当選数を確認できる");
}

async function testResultRedisplay() {
  const db = new MockD1();
  db.addPrize({ id: "prize-a", name: "再表示景品", totalWinners: 1 });
  db.setSetting("live", "win_rate_percent", "100");

  const original = await createVisitor(db, 100, { visitorCount: 4 });
  const firstReload = await getResult(db, original.anonymous_id, original.venue_id, "live");
  const secondReload = await getResult(db, original.anonymous_id, original.venue_id, "live");

  assert.equal(firstReload.anonymous_id, original.anonymous_id, "匿名IDで同じ結果を再表示できる");
  assert.equal(firstReload.draw_result_id, original.draw_result_id, "再表示で再抽選されない");
  assert.deepEqual(secondReload, firstReload, "再読み込みしても結果が変わらない");
}

async function testClaimedResultRedisplay() {
  const db = new MockD1();
  db.addPrize({ id: "prize-a", name: "受取景品", totalWinners: 1 });
  db.setSetting("live", "win_rate_percent", "100");

  const winner = await createVisitor(db, 200);
  assert.equal(winner.result, "win");

  const response = await claimPrize(adminContext(db, {
    mode: "live",
    anonymousId: winner.anonymous_id,
    venueId: winner.venue_id,
    claimed: true
  }));
  assert.equal(response.status, 200, "受取済みAPIが成功する");

  const redisplayed = await getResult(db, winner.anonymous_id, winner.venue_id, "live");
  assert.ok(redisplayed.claimed_at, "受取済み後の当選画面にも受取済み状態が反映される");

  const summary = await getAdminSummary(db, "live");
  assert.equal(summary.prizes[0].claimed_count, 1, "管理画面集計で受取済み数が増える");
}

async function testClaimIsVenueScoped() {
  const db = new MockD1();
  const browserStorage = new Map();
  db.addPrize({ id: "prize-a", name: "会場別受取景品", totalWinners: 2 });
  db.setSetting("live", "win_rate_percent", "100");

  const park = await simulateBrowserCheckin(db, browserStorage, 210, { venueId: "park", visitorCount: 1 });
  const yumeplat = await simulateBrowserCheckin(db, browserStorage, 211, { venueId: "yumeplat", visitorCount: 1 });
  assert.equal(park.result.anonymous_id, yumeplat.result.anonymous_id, "同じ端末の匿名IDで2会場の当選を持てる");
  assert.equal(park.result.result, "win");
  assert.equal(yumeplat.result.result, "win");

  const response = await claimPrize(adminContext(db, {
    mode: "live",
    anonymousId: park.result.anonymous_id,
    venueId: "park",
    claimed: true
  }));
  assert.equal(response.status, 200, "parkの受取済みAPIが成功する");

  const parkRedisplayed = await getResult(db, park.result.anonymous_id, "park", "live");
  const yumeplatRedisplayed = await getResult(db, yumeplat.result.anonymous_id, "yumeplat", "live");
  assert.ok(parkRedisplayed.claimed_at, "parkの当選だけ受取済みになる");
  assert.equal(yumeplatRedisplayed.claimed_at, null, "同じ匿名IDでもyumeplatの当選は未受取のまま");
}

async function testPrizeTotalChanges() {
  const db = new MockD1();
  await savePrizeTotal(db, 1);
  db.setSetting("live", "win_rate_percent", "100");

  const first = await createVisitor(db, 300);
  const second = await createVisitor(db, 301);
  assert.equal(first.result, "win", "変更前の1本目は当選する");
  assert.equal(second.result, "lose", "当選本数に到達したらハズレになる");

  await savePrizeTotal(db, 2);
  const third = await createVisitor(db, 302);
  assert.equal(third.result, "win", "当選本数を増やすと以降のチェックインで追加当選できる");
  assert.equal((await getResult(db, first.anonymous_id, first.venue_id, "live")).result, "win", "既存当選結果は変わらない");

  await savePrizeTotal(db, 1);
  const fourth = await createVisitor(db, 303);
  assert.equal(fourth.result, "lose", "当選済み数を下回る本数に減らしても新規当選は増えない");

  const summary = await getAdminSummary(db, "live");
  assert.equal(summary.prizes[0].win_count, 2, "既存当選は保持される");
  assert.equal(prizeVenueLimit(summary, "prize-a", "park").remaining_count, 0, "対象会場の残り本数はマイナスにならない");
}

async function testSettingsAreModeScoped() {
  const db = new MockD1();
  const response = await saveSettings(adminContext(db, {
    mode: "test",
    drawOpen: true,
    winRatePercent: 100
  }));
  assert.equal(response.status, 200, "テストモード設定APIが成功する");

  db.addPrize({ id: "prize-a", name: "本番景品", totalWinners: 1 });
  const liveResult = await createVisitor(db, 400, { mode: "live" });
  const testResult = await createVisitor(db, 401, { mode: "test" });

  assert.equal(liveResult.result, "lose", "テストモードの当選確率変更は本番に影響しない");
  assert.equal(testResult.result, "win", "テストモードでは変更後の当選確率が使われる");
}

async function testVenueStatsAndValidation() {
  const db = new MockD1();
  db.setSetting("live", "win_rate_percent", "0");

  await createVisitor(db, 500, { venueId: "park", visitorCount: 2 });
  await createVisitor(db, 501, { venueId: "yumeplat", visitorCount: 3 });

  const summary = await getAdminSummary(db, "live");
  const park = summary.venueStats.find((venue) => venue.venue_id === "park");
  const yumeplat = summary.venueStats.find((venue) => venue.venue_id === "yumeplat");
  const highschool = summary.venueStats.find((venue) => venue.venue_id === "highschool");

  assert.equal(summary.venueStats.length, 5, "登録済み5会場を管理画面に表示する");
  assert.equal(park.visitor_total, 2, "小城公園の来場者数だけが増える");
  assert.equal(park.checkin_count, 1, "小城公園のチェックイン件数を集計する");
  assert.equal(yumeplat.visitor_total, 3, "ゆめぷらっと小城の来場者数だけが増える");
  assert.equal(highschool.visitor_total, 0, "未チェックイン会場は0人で表示する");
  assert.equal(summary.venueTotal.visitorTotal, 5, "全会場合計は各会場の来場者数合計になる");
  assert.equal(park.checkin_url, "/checkin?venue=park", "会場別QR用URLを返す");

  await assert.rejects(
    () => createVisitor(db, 502, { venueId: "abc" }),
    /指定された会場は利用できません/,
    "不正なvenue_idはサーバー側で拒否する"
  );

  await assert.rejects(
    () => createVisitor(db, 503, { venueId: "" }),
    /会場URLが正しくありません/,
    "venue未指定はサーバー側で拒否する"
  );
}

async function testRequestedVenueCountingAndLocalStorageFlow() {
  const db = new MockD1();
  const browserStorage = new Map();
  db.addPrize({ id: "prize-a", name: "会場別抽選景品", totalWinners: 2 });
  db.setSetting("live", "win_rate_percent", "100");

  const park = await simulateBrowserCheckin(db, browserStorage, 600, {
    venueId: "park",
    visitorCount: 5
  });
  assert.equal(park.submitted, true, "park初回チェックインは送信される");
  let summary = await getAdminSummary(db, "live");
  assert.equal(venueStat(summary, "park").visitor_total, 5, "parkで5人チェックインするとpark来場者数が5増える");
  assert.equal(venueStat(summary, "park").checkin_count, 1, "parkチェックイン件数が1件になる");

  const yumeplat = await simulateBrowserCheckin(db, browserStorage, 601, {
    venueId: "yumeplat",
    visitorCount: 3
  });
  assert.equal(yumeplat.submitted, true, "同じ端末でもyumeplat初回チェックインは送信される");
  summary = await getAdminSummary(db, "live");
  assert.equal(venueStat(summary, "yumeplat").visitor_total, 3, "yumeplatで3人チェックインするとyumeplat来場者数が3増える");
  assert.equal(venueStat(summary, "park").visitor_total, 5, "yumeplatチェックイン後もpark来場者数は変わらない");
  assert.equal(browserStorage.has("ogi-dx2026-checkin:live:park"), true, "同じ端末でparkのLocalStorageキーを保持する");
  assert.equal(browserStorage.has("ogi-dx2026-checkin:live:yumeplat"), true, "同じ端末でyumeplatのLocalStorageキーも別に保持する");
  assert.equal(park.result.anonymous_id, yumeplat.result.anonymous_id, "同じ端末では会場をまたいでも同じ匿名IDを使う");

  const parkAgain = await simulateBrowserCheckin(db, browserStorage, 602, {
    venueId: "park",
    visitorCount: 5
  });
  assert.equal(parkAgain.submitted, false, "同じ端末・同じ会場では再チェックインを送信しない");
  assert.equal(parkAgain.result.draw_result_id, park.result.draw_result_id, "同じ端末・同じ会場では最初の抽選結果を返す");
  const duplicateParkPost = await createCheckin(db, checkinRequest(606), {
    anonymousId: park.result.anonymous_id,
    venueId: "park",
    visitorCount: 9,
    mode: "live"
  });
  assert.equal(duplicateParkPost.draw_result_id, park.result.draw_result_id, "同じ端末・同じ会場でAPIに再POSTしても再抽選しない");
  summary = await getAdminSummary(db, "live");
  assert.equal(venueStat(summary, "park").visitor_total, 5, "同じ会場の再表示ではpark来場者数が増えない");
  assert.equal(venueStat(summary, "park").checkin_count, 1, "同じ会場の再表示ではparkチェックイン件数が増えない");

  await simulateBrowserCheckin(db, browserStorage, 603, { venueId: "highschool", visitorCount: 2 });
  await simulateBrowserCheckin(db, browserStorage, 604, { venueId: "university", visitorCount: 4 });
  await simulateBrowserCheckin(db, browserStorage, 605, { venueId: "sakuraoka", visitorCount: 1 });
  summary = await getAdminSummary(db, "live");

  const expectedVisitors = {
    park: 5,
    yumeplat: 3,
    highschool: 2,
    university: 4,
    sakuraoka: 1
  };
  for (const venue of CHECKIN_VENUES) {
    assert.equal(venueStat(summary, venue.id).visitor_total, expectedVisitors[venue.id], `${venue.id}の来場者数を正しく集計する`);
    assert.equal(venueStat(summary, venue.id).checkin_count, 1, `${venue.id}のチェックイン件数を正しく集計する`);
  }
  assert.equal(db.drawResults.length, 5, "同じ端末で5会場すべてを回ると会場ごとに1回ずつ最大5回抽選できる");
  assert.equal(new Set(db.drawResults.map((result) => result.venue_id)).size, 5, "抽選結果は5会場それぞれに紐づく");
  assert.equal(summary.venueTotal.visitorTotal, 15, "全会場合計は5会場の来場者数合計と一致する");
  assert.equal(summary.venueTotal.checkinCount, 5, "全会場チェックイン件数は実チェックイン件数と一致する");

  const wins = summary.winners.length;
  assert.equal(wins, 5, "同じ端末でも5会場それぞれで1回ずつ抽選できる");
  for (const venue of CHECKIN_VENUES) {
    const limit = prizeVenueLimit(summary, "prize-a", venue.id);
    assert.equal(limit.win_count, 1, `${venue.id}の当選数は他会場に影響されず集計される`);
    assert.equal(limit.remaining_count, 1, `${venue.id}の残り当選数は会場別に残る`);
  }
}

function testCheckinPageHasSafeMissingVenueHandling() {
  const source = readFileSync(new URL("../src/pages/checkin.astro", import.meta.url), "utf8");
  const styles = readFileSync(new URL("../src/styles/global.css", import.meta.url), "utf8");
  assert.match(source, /venues\.get\(rawVenueId\)/, "チェックイン画面は許可済み会場リストでvenueを照合する");
  assert.match(source, /会場URLが正しくありません/, "/checkinや不正venueで安全なエラーを表示する");
  assert.match(source, /ogi-dx2026-checkin:\$\{mode\}:\$\{venueId\}/, "LocalStorageキーは会場別になっている");
  assert.match(source, /ogi-dx2026-visitor:\$\{mode\}/, "端末の匿名IDはmode単位で保持する");
  assert.match(source, /anonymousId, visitorCount, venueId, mode/, "チェックインAPIへ端末の匿名IDと会場IDを送信する");
  assert.match(source, /venue=\$\{encodeURIComponent\(venueId\)\}/, "結果再表示APIへ会場IDを送信する");
  assert.match(source, /customInput\.disabled = !isCustomCount/, "1〜4名選択時は5名以上入力欄を無効化する");
  assert.match(source, /const minVisitorCount = isCustomCount \? 5 : 1/, "5名以上だけ5〜99名の入力を許可する");
  assert.match(styles, /\.checkin-custom-count\[hidden\]\s*\{\s*display:\s*none;/s, "5名以上入力欄のhidden表示をCSSで確実に非表示にする");
  assert.match(source, /残念！今回はハズレです/, "ハズレ画面は明確にハズレと表示する");
  assert.match(source, /ご参加ありがとうございます！<br \/>引き続きお楽しみください。/, "ハズレ画面に指定メッセージを表示する");
  assert.match(source, /🎉 当選！/, "当選画面はハズレと明確に区別する");
  assert.match(source, /景品：/, "当選画面に景品名を分かりやすく表示する");
  assert.doesNotMatch(source, /抽選番号/, "来場者向け結果画面に抽選番号を表示しない");
  assert.doesNotMatch(source, /氏名・電話番号・メールアドレス/, "来場者向け画面に個人情報を取得しない旨の文章を表示しない");
}

function testAdminPageHasVenueLimitUi() {
  const source = readFileSync(new URL("../src/pages/admin/checkin.astro", import.meta.url), "utf8");
  assert.match(source, /会場ごとの当選本数/, "管理画面で会場ごとの当選本数を入力できる");
  assert.match(source, /設定当選数：/, "管理画面で会場別の設定当選数を表示する");
  assert.match(source, /当選済み：/, "管理画面で会場別の当選済み数を表示する");
  assert.match(source, /残り：/, "管理画面で会場別の残り当選数を表示する");
  assert.match(source, /venueLimits/, "景品保存APIへ会場別当選本数を送信する");
}

function testMigrationAddsVenueLimitsSafely() {
  const migration = readFileSync(new URL("../migrations/0002_prize_venue_limits.sql", import.meta.url), "utf8");
  assert.match(migration, /CREATE TABLE IF NOT EXISTS prize_venue_limits/, "追加migrationで会場別当選上限テーブルを作成する");
  assert.match(migration, /INSERT OR IGNORE INTO prize_venue_limits/, "既存景品に5会場分の初期行を安全に追加する");
  assert.doesNotMatch(migration, /DROP TABLE/i, "追加migrationで既存テーブルを削除しない");
  assert.doesNotMatch(migration, /DELETE FROM/i, "追加migrationで既存データを削除しない");
}

async function testAdminPageRequiresAuth() {
  const env = { CHECKIN_ADMIN_TOKEN: ADMIN_TOKEN };
  const unauthenticated = await guardAdminPage({
    request: new Request("https://example.test/admin/checkin"),
    env,
    next: () => new Response("ok")
  });
  assert.equal(unauthenticated.status, 401, "管理画面HTMLは認証なしで表示できない");

  const authenticated = await guardAdminPage({
    request: new Request("https://example.test/admin/checkin", {
      headers: {
        Authorization: `Basic ${btoa(`admin:${ADMIN_TOKEN}`)}`
      }
    }),
    env,
    next: () => new Response("ok")
  });
  assert.equal(authenticated.status, 200, "正しいBasic認証で管理画面を表示できる");
}

testVisitorCountSelectionRules();
await testConcurrentWinnerCap();
await testVenueSpecificWinnerCaps();
await testResultRedisplay();
await testClaimedResultRedisplay();
await testClaimIsVenueScoped();
await testPrizeTotalChanges();
await testSettingsAreModeScoped();
await testVenueStatsAndValidation();
await testRequestedVenueCountingAndLocalStorageFlow();
testCheckinPageHasSafeMissingVenueHandling();
testAdminPageHasVenueLimitUi();
testMigrationAddsVenueLimitsSafely();
await testAdminPageRequiresAuth();

console.log("checkin lottery tests passed");
