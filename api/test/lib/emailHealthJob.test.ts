import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { env } from 'cloudflare:test'
import { resetDb, applyMigrations } from '../helpers'
import { getDb } from '../../src/db/client'
import { emailAlertState } from '../../src/db/schema'
import { recordSendStats } from '../../src/lib/emailStats'
import { runEmailHealth } from '../../src/lib/emailHealthJob'

const NOW = new Date('2026-09-23T21:00:00Z')
const LAST_HOUR = new Date('2026-09-23T20:30:00Z')
const ERR = 'E_RECIPIENT_NOT_ALLOWED: destination address is not a verified address'

function jobEnv(overrides: Record<string, unknown> = {}) {
  const cfSend = vi.fn(async () => ({ messageId: 'cf-alert' }))
  const e = {
    ...env, EMAIL_PROVIDER: 'cloudflare', RESEND_API_KEY: 'k',
    EMAIL: { send: cfSend }, ALERT_EMAILS: 'ops@example.test',
    APP_URL: 'https://ut.example.test', EMAIL_FROM: 'notifications@example.test',
    ...overrides,
  }
  return { e: e as never, cfSend }
}

describe('runEmailHealth', () => {
  let fetch: ReturnType<typeof vi.fn>
  beforeEach(async () => {
    await resetDb(); await applyMigrations()
    fetch = vi.fn(async () => new Response(JSON.stringify({ id: 'rs-alert' }), { status: 200 }))
    vi.stubGlobal('fetch', fetch)
  })
  afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks() })

  it('does nothing when healthy', async () => {
    const db = getDb(env.DB)
    await recordSendStats(db, 'cloudflare', { sent: 5, failed: 0, suppressed: 0, lastError: null }, LAST_HOUR)
    const { e } = jobEnv()
    expect(await runEmailHealth(e, db, NOW)).toBe('none')
    expect(fetch).not.toHaveBeenCalled()
    expect(await db.select().from(emailAlertState).all()).toHaveLength(0)
  })

  it('on trip, alerts through resend (not the failing cloudflare) and records failing state', async () => {
    const db = getDb(env.DB)
    await recordSendStats(db, 'cloudflare', { sent: 0, failed: 3, suppressed: 0, lastError: ERR }, LAST_HOUR)
    const { e, cfSend } = jobEnv()
    expect(await runEmailHealth(e, db, NOW)).toBe('trip')
    expect(cfSend).not.toHaveBeenCalled()
    expect(fetch).toHaveBeenCalledOnce()
    const body = JSON.parse((fetch.mock.calls[0][1] as RequestInit).body as string)
    expect(body.to).toEqual(['ops@example.test'])
    expect(body.subject).toContain('ut.example.test')
    expect(body.subject).toContain('cloudflare')
    expect(body.text).toContain(ERR)
    expect(body.text).toMatch(/Digests and week-ahead mail do not fall back/)
    const [state] = await db.select().from(emailAlertState).all()
    expect(state).toMatchObject({
      provider: 'cloudflare', status: 'failing',
      failingSince: '2026-09-23 21:00:00', lastAlertedAt: '2026-09-23 21:00:00',
    })
  })

  it('with no other provider, alerts through the primary and logs that there is no independent path', async () => {
    const err = vi.spyOn(console, 'error').mockImplementation(() => {})
    const db = getDb(env.DB)
    await recordSendStats(db, 'cloudflare', { sent: 0, failed: 3, suppressed: 0, lastError: ERR }, LAST_HOUR)
    const { e, cfSend } = jobEnv({ RESEND_API_KEY: undefined })
    expect(await runEmailHealth(e, db, NOW)).toBe('trip')
    expect(cfSend).toHaveBeenCalledOnce()
    expect(fetch).not.toHaveBeenCalled()
    expect(err.mock.calls.some(c => String(c[0]).includes('no independent alert path'))).toBe(true)
  })

  it('records state even when ALERT_EMAILS is unset, and sends nothing', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    const db = getDb(env.DB)
    await recordSendStats(db, 'cloudflare', { sent: 0, failed: 3, suppressed: 0, lastError: ERR }, LAST_HOUR)
    const { e } = jobEnv({ ALERT_EMAILS: '' })
    expect(await runEmailHealth(e, db, NOW)).toBe('trip')
    expect(fetch).not.toHaveBeenCalled()
    const [state] = await db.select().from(emailAlertState).all()
    expect(state).toMatchObject({ status: 'failing', lastAlertedAt: null })
  })

  it('on recover, sends a recovery notice and returns to ok', async () => {
    const db = getDb(env.DB)
    await db.insert(emailAlertState).values({
      provider: 'cloudflare', status: 'failing', failingSince: '2026-09-22 10:00:00', lastAlertedAt: '2026-09-23 12:00:00',
    })
    await recordSendStats(db, 'cloudflare', { sent: 4, failed: 0, suppressed: 0, lastError: null }, LAST_HOUR)
    const { e } = jobEnv()
    expect(await runEmailHealth(e, db, NOW)).toBe('recover')
    const body = JSON.parse((fetch.mock.calls[0][1] as RequestInit).body as string)
    expect(body.subject).toMatch(/recovered/i)
    const [state] = await db.select().from(emailAlertState).all()
    expect(state).toMatchObject({ status: 'ok', failingSince: null, recoveredAt: '2026-09-23 21:00:00' })
  })

  it("reports the other provider's sends in the window as the rescue count", async () => {
    const db = getDb(env.DB)
    await recordSendStats(db, 'cloudflare', { sent: 0, failed: 3, suppressed: 0, lastError: ERR }, LAST_HOUR)
    await recordSendStats(db, 'resend', { sent: 3, failed: 0, suppressed: 0, lastError: null }, LAST_HOUR)
    const { e } = jobEnv()
    await runEmailHealth(e, db, NOW)
    const body = JSON.parse((fetch.mock.calls[0][1] as RequestInit).body as string)
    expect(body.text).toContain('3 sent through resend')
  })
})
