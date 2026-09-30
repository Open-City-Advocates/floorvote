import { describe, it, expect } from 'vitest'
import { decideEmailHealth, OK_STATE, type HourStat, type HealthState } from './emailHealth'
import { hourKey } from './emailStats'

const row = (hour: string, sent: number, failed: number, suppressed = 0): HourStat =>
  ({ hour: `${hour}:00:00`, sent, failed, suppressed, lastError: failed ? 'E_RECIPIENT_NOT_ALLOWED: destination address is not a verified address' : null })

const at = (s: string) => new Date(s.replace(' ', 'T') + 'Z')
const failing = (lastAlertedAt: string): HealthState =>
  ({ status: 'failing', failingSince: '2026-09-23 21:00:00', lastAlertedAt, recoveredAt: null })

// UT's real hourly Cloudflare send outcomes, 2026-09-18 to 2026-09-29, from
// auth_events. The outage began in the 20:00 hour on 2026-09-23. The one success
// at 21:00 that day went to a verified address: E_RECIPIENT_NOT_ALLOWED blocked
// only unverified recipients, which is why the operator's own logins kept working.
const UT: HourStat[] = [
  row('2026-09-18 16', 2, 0), row('2026-09-18 17', 8, 0), row('2026-09-18 18', 2, 0),
  row('2026-09-18 20', 3, 0), row('2026-09-18 22', 4, 0),
  row('2026-09-21 15', 2, 0), row('2026-09-21 18', 3, 0), row('2026-09-21 20', 1, 0), row('2026-09-21 21', 1, 0),
  row('2026-09-22 16', 2, 0), row('2026-09-22 18', 1, 0),
  row('2026-09-23 20', 0, 3), row('2026-09-23 21', 1, 1),
  row('2026-09-24 14', 0, 4),
  row('2026-09-29 14', 0, 6), row('2026-09-29 15', 0, 6), row('2026-09-29 17', 0, 4),
]

// What the job can see when the cron fires at `now`: rows for completed hours only.
const seenAt = (rows: HourStat[], now: Date) => rows.filter(r => r.hour < hourKey(now))

describe('decideEmailHealth — replaying the 2026-09-23 UT outage', () => {
  it('stays quiet at 20:00, before any failure is visible', () => {
    const now = at('2026-09-23 20:00:00')
    expect(decideEmailHealth(now, seenAt(UT, now), OK_STATE)).toBe('none')
  })

  it('trips at 21:00, one hour after the first failure', () => {
    const now = at('2026-09-23 21:00:00')
    expect(decideEmailHealth(now, seenAt(UT, now), OK_STATE)).toBe('trip')
  })

  it('does not recover on the single verified-address success at 21:00', () => {
    const now = at('2026-09-23 22:00:00')
    expect(decideEmailHealth(now, seenAt(UT, now), failing('2026-09-23 21:00:00'))).toBe('none')
  })

  it('stays failing through the five-day gap with no traffic, and reminds daily', () => {
    const now = at('2026-09-26 12:00:00')
    expect(decideEmailHealth(now, seenAt(UT, now), failing('2026-09-25 11:00:00'))).toBe('remind')
    expect(decideEmailHealth(now, seenAt(UT, now), failing('2026-09-26 11:00:00'))).toBe('none')
  })

  // After the cutover. These success rows are synthetic: UT had no post-fix sends yet.
  const AFTER = [...UT, row('2026-09-29 23', 5, 0), row('2026-09-30 18', 2, 0), row('2026-09-30 19', 2, 0)]

  it('does not recover while the last failure is inside the 24-hour window', () => {
    const now = at('2026-09-30 16:00:00')
    expect(decideEmailHealth(now, seenAt(AFTER, now), failing('2026-09-30 12:00:00'))).toBe('none')
  })

  it('recovers after 24 clean hours with at least three successes', () => {
    const now = at('2026-09-30 20:00:00')
    expect(decideEmailHealth(now, seenAt(AFTER, now), failing('2026-09-30 12:00:00'))).toBe('recover')
  })
})

describe('decideEmailHealth — rules', () => {
  const now = at('2026-10-05 12:00:00')

  it('never trips on a single failure', () => {
    expect(decideEmailHealth(now, [row('2026-10-05 11', 0, 1)], OK_STATE)).toBe('none')
  })

  it('trips at two failures when they are at least half of attempts', () => {
    expect(decideEmailHealth(now, [row('2026-10-05 11', 2, 2)], OK_STATE)).toBe('trip')
    expect(decideEmailHealth(now, [row('2026-10-05 11', 3, 2)], OK_STATE)).toBe('none')
  })

  it('ignores suppressed recipients entirely', () => {
    expect(decideEmailHealth(now, [row('2026-10-05 11', 0, 0, 40)], OK_STATE)).toBe('none')
  })

  it('ignores rows older than 24 hours', () => {
    expect(decideEmailHealth(now, [row('2026-10-04 10', 0, 9)], OK_STATE)).toBe('none')
  })

  it('does not re-trip on failures from before the last recovery', () => {
    const state: HealthState = { ...OK_STATE, recoveredAt: '2026-10-05 09:30:00' }
    expect(decideEmailHealth(now, [row('2026-10-05 08', 0, 5)], state)).toBe('none')
    expect(decideEmailHealth(now, [row('2026-10-05 10', 0, 5)], state)).toBe('trip')
  })

  it('reminds when failing and never successfully alerted', () => {
    const state: HealthState = { status: 'failing', failingSince: '2026-10-05 11:00:00', lastAlertedAt: null, recoveredAt: null }
    expect(decideEmailHealth(now, [row('2026-10-05 11', 0, 3)], state)).toBe('remind')
  })

  it('does not recover on fewer than three successes even with zero failures', () => {
    expect(decideEmailHealth(now, [row('2026-10-05 11', 2, 0)], failing('2026-10-05 11:30:00'))).toBe('none')
  })

  it('recovers with one stray failure among many successes (under 10%)', () => {
    expect(decideEmailHealth(now, [row('2026-10-05 11', 20, 1)], failing('2026-10-05 11:30:00'))).toBe('recover')
  })

  it('does not recover when failures are 20% of sends', () => {
    expect(decideEmailHealth(now, [row('2026-10-05 11', 5, 1)], failing('2026-10-05 11:30:00'))).toBe('none')
  })
})
