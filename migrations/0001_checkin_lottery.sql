CREATE TABLE IF NOT EXISTS checkins (
  id TEXT PRIMARY KEY,
  anonymous_id TEXT NOT NULL,
  venue_id TEXT NOT NULL,
  visitor_count INTEGER NOT NULL CHECK (visitor_count BETWEEN 1 AND 99),
  mode TEXT NOT NULL DEFAULT 'live' CHECK (mode IN ('live', 'test')),
  user_agent_hash TEXT,
  checked_in_at TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (anonymous_id, venue_id, mode)
);

CREATE INDEX IF NOT EXISTS idx_checkins_mode_created_at
  ON checkins (mode, created_at);

CREATE INDEX IF NOT EXISTS idx_checkins_mode_venue
  ON checkins (mode, venue_id);

CREATE TABLE IF NOT EXISTS prizes (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  total_winners INTEGER NOT NULL DEFAULT 0 CHECK (total_winners >= 0),
  enabled INTEGER NOT NULL DEFAULT 1 CHECK (enabled IN (0, 1)),
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_prizes_enabled_sort
  ON prizes (enabled, sort_order);

CREATE TABLE IF NOT EXISTS draw_results (
  id TEXT PRIMARY KEY,
  anonymous_id TEXT NOT NULL,
  checkin_id TEXT NOT NULL,
  venue_id TEXT NOT NULL,
  prize_id TEXT,
  result TEXT NOT NULL CHECK (result IN ('win', 'lose')),
  mode TEXT NOT NULL DEFAULT 'live' CHECK (mode IN ('live', 'test')),
  drawn_at TEXT NOT NULL,
  claimed_at TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (anonymous_id, venue_id, mode),
  FOREIGN KEY (checkin_id) REFERENCES checkins (id),
  FOREIGN KEY (prize_id) REFERENCES prizes (id)
);

CREATE INDEX IF NOT EXISTS idx_draw_results_mode_result
  ON draw_results (mode, result);

CREATE INDEX IF NOT EXISTS idx_draw_results_mode_prize
  ON draw_results (mode, prize_id);

CREATE INDEX IF NOT EXISTS idx_draw_results_mode_venue
  ON draw_results (mode, venue_id);

CREATE INDEX IF NOT EXISTS idx_draw_results_claimed
  ON draw_results (mode, claimed_at);

CREATE TABLE IF NOT EXISTS settings (
  key TEXT NOT NULL,
  mode TEXT NOT NULL DEFAULT 'live' CHECK (mode IN ('live', 'test')),
  value TEXT NOT NULL,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (key, mode)
);

INSERT OR IGNORE INTO settings (key, mode, value)
VALUES
  ('draw_open', 'live', 'true'),
  ('win_rate_percent', 'live', '0'),
  ('draw_open', 'test', 'true'),
  ('win_rate_percent', 'test', '0');
