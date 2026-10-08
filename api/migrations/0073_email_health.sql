-- Email health, for the email outage resilience work.
--
-- email_send_stats counts every send attempt per UTC hour and provider, so the
-- hourly email-health job can see a provider failing. It covers all mail,
-- including digests, which write nothing to auth_events. A recipient-specific
-- failure (a suppressed address) is counted in suppressed and never in failed,
-- so a few dead addresses in a digest cannot page the operator.
--
-- email_alert_state holds one row per provider for that job. It records whether
-- the provider is failing, since when, and when the operator was last told. A
-- missing row means ok.
--
-- Numbered 0073 rather than 0071 because open PR floorvote/floorvote#215 claims
-- 0071 and 0072.
--
-- No semicolons in these comments. api/test/helpers.ts splits migration files
-- on the statement terminator before it strips comment lines.
CREATE TABLE email_send_stats (
  hour TEXT NOT NULL,
  provider TEXT NOT NULL,
  sent INTEGER NOT NULL DEFAULT 0,
  failed INTEGER NOT NULL DEFAULT 0,
  suppressed INTEGER NOT NULL DEFAULT 0,
  last_error TEXT,
  last_sent_at TEXT,
  last_failed_at TEXT,
  PRIMARY KEY (hour, provider)
);
CREATE TABLE email_alert_state (
  provider TEXT PRIMARY KEY,
  status TEXT NOT NULL DEFAULT 'ok' CHECK (status IN ('ok', 'failing')),
  failing_since TEXT,
  last_alerted_at TEXT,
  recovered_at TEXT
);
