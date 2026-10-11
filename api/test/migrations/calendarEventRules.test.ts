import { describe, it, expect, beforeEach } from 'vitest'
import { env } from 'cloudflare:test'
import { resetDb, applyMigrations } from '../helpers'

// 0083: calendar events gain rule_facets and rule_match, for the instance's
// event rules (#298). Existing events keep everything they had, including the
// UID and SEQUENCE calendar clients already know them by, and with no rules
// saved every body event still shows (rule_match null).
describe('0083_calendar_event_rules', () => {
  beforeEach(async () => {
    await resetDb()
    await applyMigrations({ before: '0083' })
    const insert = env.DB.prepare(`INSERT INTO calendar_events (id, uid, bill_id, source, kind, sequence, date, description, status) VALUES (?, ?, ?, ?, ?, ?, '2026-10-23', ?, ?)`)
    await env.DB.batch([
      insert.bind('body', 'council-2405@lims.dccouncil.gov', null, 'body', 'hearing', 3, 'Committee of the Whole hearing', 'confirmed'),
      insert.bind('hearing', 'hearing-legiscan-1012600769-hearing-2026-10-23-public-hearing-on-b26-0769@team', 'bill-1', 'hearing', 'hearing', 2, 'Public Hearing on B26-0769', 'cancelled'),
    ])
    await applyMigrations()
  })

  it('adds empty rule columns and leaves every event as it was', async () => {
    const { results } = await env.DB.prepare(`SELECT id, uid, source, sequence, status, rule_facets, rule_match FROM calendar_events ORDER BY id`).all()
    expect(results).toEqual([
      { id: 'body', uid: 'council-2405@lims.dccouncil.gov', source: 'body', sequence: 3, status: 'confirmed', rule_facets: null, rule_match: null },
      { id: 'hearing', uid: 'hearing-legiscan-1012600769-hearing-2026-10-23-public-hearing-on-b26-0769@team', source: 'hearing', sequence: 2, status: 'cancelled', rule_facets: null, rule_match: null },
    ])
  })
})
