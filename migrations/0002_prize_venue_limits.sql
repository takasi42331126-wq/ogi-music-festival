CREATE TABLE IF NOT EXISTS prize_venue_limits (
  prize_id TEXT NOT NULL,
  venue_id TEXT NOT NULL,
  total_winners INTEGER NOT NULL DEFAULT 0 CHECK (total_winners >= 0),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (prize_id, venue_id),
  FOREIGN KEY (prize_id) REFERENCES prizes (id)
);

CREATE INDEX IF NOT EXISTS idx_prize_venue_limits_venue
  ON prize_venue_limits (venue_id);

INSERT OR IGNORE INTO prize_venue_limits
  (prize_id, venue_id, total_winners, created_at, updated_at)
SELECT p.id, venues.venue_id, p.total_winners, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM prizes p
CROSS JOIN (
  SELECT 'park' AS venue_id
  UNION ALL SELECT 'yumeplat'
  UNION ALL SELECT 'highschool'
  UNION ALL SELECT 'university'
  UNION ALL SELECT 'sakuraoka'
) venues;
