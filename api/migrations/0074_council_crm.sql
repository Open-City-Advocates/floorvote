-- A light CRM for the Council: the team's own record of each Councilmember's
-- office and each Council staffer. The people come from the Council directory
-- central syncs from dccouncil.gov and LIMS. person_key is "cm:<name>" for a
-- Councilmember (stable across Council Periods, which give a member a new LIMS
-- id) and "staff:<email>" for a staffer, or "staff:<name>|<office>" when the
-- directory lists no email. Name and office are kept as written, so a record
-- outlasts the person's directory listing.
CREATE TABLE crm_people (
  person_key  TEXT PRIMARY KEY,
  name        TEXT NOT NULL,
  office      TEXT,
  owner_id    TEXT,
  stance      TEXT,
  updated_by  TEXT,
  updated_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE crm_contacts (
  id           TEXT PRIMARY KEY,
  person_key   TEXT NOT NULL,
  contact_date TEXT NOT NULL,
  kind         TEXT NOT NULL CHECK (kind IN ('meeting', 'call', 'email', 'testimony', 'event', 'other')),
  summary      TEXT NOT NULL,
  bill_id      TEXT,
  author_id    TEXT,
  created_at   TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at   TEXT
);

CREATE INDEX idx_crm_contacts_person ON crm_contacts (person_key, contact_date);

CREATE TABLE crm_followups (
  id          TEXT PRIMARY KEY,
  person_key  TEXT NOT NULL,
  due_date    TEXT,
  text        TEXT NOT NULL,
  owner_id    TEXT,
  done_at     TEXT,
  done_by     TEXT,
  author_id   TEXT,
  created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX idx_crm_followups_person ON crm_followups (person_key);
CREATE INDEX idx_crm_followups_open ON crm_followups (done_at, due_date);
