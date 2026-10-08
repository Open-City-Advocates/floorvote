import { describe, it, expect, beforeEach, vi } from 'vitest'
import { env } from 'cloudflare:test'
import { resetDb, applyMigrations } from '../helpers'
import { getDb } from '../../src/db/client'
import { authEvents } from '../../src/db/schema'
import { sendMagicLink } from '../../src/lib/email'

const baseEnv = (overrides: Record<string, unknown> = {}) => ({
  APP_URL: 'http://localhost', EMAIL_PROVIDER: 'cloudflare', DEMO_MODE: 'false',
  ASSOCIATION_NAME: 'Test', EMAIL_FROM: 'notifications@example.com',
  ...overrides,
}) as never

describe('sendMagicLink records auth events', () => {
  beforeEach(async () => { await resetDb(); await applyMigrations() })

  it('records email_sent (with messageId) on a successful cloudflare send', async () => {
    const db = getDb(env.DB)
    const EMAIL = { send: vi.fn().mockResolvedValue({ messageId: 'cf-123' }) }
    await sendMagicLink('a@b.com', 'http://localhost/auth/verify?token=t', baseEnv({ EMAIL }), 'login', db, 'user-1')
    const [row] = await db.select().from(authEvents).all()
    expect(row.event).toBe('email_sent')
    expect(row.messageId).toBe('cf-123')
    expect(row.userId).toBe('user-1')
    expect(row.provider).toBe('cloudflare')
    expect(row.linkType).toBe('login')
  })

  it('records email_bounced when the recipient is suppressed', async () => {
    const db = getDb(env.DB)
    const EMAIL = { send: vi.fn().mockRejectedValue(Object.assign(new Error('suppressed'), { code: 'E_RECIPIENT_SUPPRESSED' })) }
    await sendMagicLink('a@b.com', 'http://localhost/x', baseEnv({ EMAIL }), 'login', db, 'user-1').catch(() => {})
    const [row] = await db.select().from(authEvents).all()
    expect(row.event).toBe('email_bounced')
    expect(row.reason).toContain('E_RECIPIENT_SUPPRESSED')
  })

  it('records email_send_failed on other provider errors', async () => {
    const db = getDb(env.DB)
    const EMAIL = { send: vi.fn().mockRejectedValue(Object.assign(new Error('slow down'), { code: 'E_RATE_LIMIT_EXCEEDED' })) }
    await sendMagicLink('a@b.com', 'http://localhost/x', baseEnv({ EMAIL }), 'login', db, 'user-1').catch(() => {})
    const [row] = await db.select().from(authEvents).all()
    expect(row.event).toBe('email_send_failed')
    expect(row.reason).toContain('E_RATE_LIMIT_EXCEEDED')
  })

  it('falls back to resend and records both attempts when cloudflare fails', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ id: 'rs-9' }), { status: 200 })))
    const db = getDb(env.DB)
    const EMAIL = { send: vi.fn().mockRejectedValue(Object.assign(new Error('not verified'), { code: 'E_RECIPIENT_NOT_ALLOWED' })) }
    await expect(sendMagicLink('a@b.com', 'http://localhost/x', baseEnv({ EMAIL, RESEND_API_KEY: 'k' }), 'login', db, 'user-1'))
      .resolves.toBeUndefined()
    const rows = await db.select().from(authEvents).all()
    expect(rows).toHaveLength(2)
    const failed = rows.find(r => r.event === 'email_send_failed')!
    const sent = rows.find(r => r.event === 'email_sent')!
    expect(failed).toMatchObject({ provider: 'cloudflare', linkType: 'login', userId: 'user-1' })
    expect(failed.reason).toContain('E_RECIPIENT_NOT_ALLOWED')
    expect(sent).toMatchObject({ provider: 'resend', messageId: 'rs-9', linkType: 'login', userId: 'user-1' })
    vi.unstubAllGlobals()
  })

  it('still throws, with both attempts logged, when the fallback also fails', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('bad key', { status: 401 })))
    vi.spyOn(console, 'error').mockImplementation(() => {})
    const db = getDb(env.DB)
    const EMAIL = { send: vi.fn().mockRejectedValue(Object.assign(new Error('x'), { code: 'E_RECIPIENT_NOT_ALLOWED' })) }
    await expect(sendMagicLink('a@b.com', 'http://localhost/x', baseEnv({ EMAIL, RESEND_API_KEY: 'k' }), 'invite', db, 'user-1'))
      .rejects.toThrow(/resend/)
    const events = (await db.select().from(authEvents).all()).map(r => `${r.provider}:${r.event}`).sort()
    expect(events).toEqual(['cloudflare:email_send_failed', 'resend:email_send_failed'])
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it('does not fall back for a suppressed recipient', async () => {
    const fetch = vi.fn()
    vi.stubGlobal('fetch', fetch)
    const db = getDb(env.DB)
    const EMAIL = { send: vi.fn().mockRejectedValue(Object.assign(new Error('s'), { code: 'E_RECIPIENT_SUPPRESSED' })) }
    await sendMagicLink('a@b.com', 'http://localhost/x', baseEnv({ EMAIL, RESEND_API_KEY: 'k' }), 'login', db, 'user-1').catch(() => {})
    expect(fetch).not.toHaveBeenCalled()
    const rows = await db.select().from(authEvents).all()
    expect(rows.map(r => r.event)).toEqual(['email_bounced'])
    vi.unstubAllGlobals()
  })
})
