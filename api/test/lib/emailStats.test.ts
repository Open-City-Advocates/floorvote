import { describe, it, expect, beforeEach, vi } from 'vitest'
import { env } from 'cloudflare:test'
import { resetDb, applyMigrations } from '../helpers'
import { getDb } from '../../src/db/client'
import { emailSendStats } from '../../src/db/schema'
import { hourKey, isRecipientError, tally, recordSendStats } from '../../src/lib/emailStats'

const T = new Date('2026-09-23T20:17:42Z')

describe('hourKey', () => {
  it('truncates to the UTC hour in DB format', () => {
    expect(hourKey(T)).toBe('2026-09-23 20:00:00')
  })
})

describe('isRecipientError', () => {
  it('is true only for E_RECIPIENT_SUPPRESSED', () => {
    expect(isRecipientError({ error: 'E_RECIPIENT_SUPPRESSED: suppressed' })).toBe(true)
    expect(isRecipientError({ error: 'E_RECIPIENT_NOT_ALLOWED: destination address is not a verified address' })).toBe(false)
    expect(isRecipientError({ error: '401' })).toBe(false)
    expect(isRecipientError({})).toBe(false)
  })
})

describe('tally', () => {
  it('splits results into sent, failed, and suppressed, keeping the last provider error', () => {
    expect(tally([
      { ok: true, provider: 'cloudflare' },
      { ok: false, provider: 'cloudflare', error: 'E_RECIPIENT_NOT_ALLOWED: a' },
      { ok: false, provider: 'cloudflare', error: 'E_RECIPIENT_SUPPRESSED: b' },
      { ok: false, provider: 'cloudflare', error: 'E_RATE_LIMIT_EXCEEDED: c' },
    ])).toEqual({ sent: 1, failed: 2, suppressed: 1, lastError: 'E_RATE_LIMIT_EXCEEDED: c' })
  })
})

describe('recordSendStats', () => {
  beforeEach(async () => { await resetDb(); await applyMigrations() })

  it('upserts into one row per hour and provider, incrementing counts', async () => {
    const db = getDb(env.DB)
    await recordSendStats(db, 'cloudflare', { sent: 1, failed: 0, suppressed: 0, lastError: null }, T)
    await recordSendStats(db, 'cloudflare', { sent: 0, failed: 2, suppressed: 1, lastError: 'E_RECIPIENT_NOT_ALLOWED: x' }, new Date('2026-09-23T20:40:00Z'))
    const rows = await db.select().from(emailSendStats).all()
    expect(rows).toHaveLength(1)
    expect(rows[0]).toMatchObject({
      hour: '2026-09-23 20:00:00', provider: 'cloudflare',
      sent: 1, failed: 2, suppressed: 1,
      lastError: 'E_RECIPIENT_NOT_ALLOWED: x',
      lastSentAt: '2026-09-23 20:17:42',
      lastFailedAt: '2026-09-23 20:40:00',
    })
  })

  it('keeps separate rows per provider and per hour', async () => {
    const db = getDb(env.DB)
    await recordSendStats(db, 'cloudflare', { sent: 1, failed: 0, suppressed: 0, lastError: null }, T)
    await recordSendStats(db, 'resend', { sent: 1, failed: 0, suppressed: 0, lastError: null }, T)
    await recordSendStats(db, 'cloudflare', { sent: 1, failed: 0, suppressed: 0, lastError: null }, new Date('2026-09-23T21:05:00Z'))
    expect(await db.select().from(emailSendStats).all()).toHaveLength(3)
  })

  it('does not overwrite last_error with null on a later success', async () => {
    const db = getDb(env.DB)
    await recordSendStats(db, 'cloudflare', { sent: 0, failed: 1, suppressed: 0, lastError: 'boom' }, T)
    await recordSendStats(db, 'cloudflare', { sent: 1, failed: 0, suppressed: 0, lastError: null }, T)
    const [row] = await db.select().from(emailSendStats).all()
    expect(row.lastError).toBe('boom')
  })

  it('writes nothing for an empty tally', async () => {
    const db = getDb(env.DB)
    await recordSendStats(db, 'cloudflare', { sent: 0, failed: 0, suppressed: 0, lastError: null }, T)
    expect(await db.select().from(emailSendStats).all()).toHaveLength(0)
  })

  it('never throws when the write fails', async () => {
    const err = vi.spyOn(console, 'error').mockImplementation(() => {})
    const broken = { insert: () => { throw new Error('D1 down') } } as never
    await expect(recordSendStats(broken, 'cloudflare', { sent: 1, failed: 0, suppressed: 0, lastError: null }, T)).resolves.toBeUndefined()
    expect(err).toHaveBeenCalled()
    err.mockRestore()
  })
})
