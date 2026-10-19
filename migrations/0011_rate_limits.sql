-- Fixed-window counters for rate limiting (tool calls, client registration,
-- client-metadata fetches). One row per limited thing (`key`), holding when its
-- current window opened and how many hits it has taken. A hit in a window that
-- has run out starts a new window at one; rows for idle keys are swept up by
-- `purgeRateLimits` now and then.
CREATE TABLE rate_limits (
  key TEXT PRIMARY KEY,
  window_start INTEGER NOT NULL,
  count INTEGER NOT NULL
);

CREATE INDEX idx_rate_limits_window ON rate_limits (window_start);
