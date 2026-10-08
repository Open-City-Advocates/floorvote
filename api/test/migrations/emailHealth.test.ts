import { describe, it, expect, beforeEach } from 'vitest'
import { env } from 'cloudflare:test'
import { applyMigrations, resetDb } from '../helpers'

describe('migration 0073_email_health', () => {
  beforeEach(async () => {
    await resetDb()
    await applyMigrations()
  })

  it('creates email_send_stats keyed on (hour, provider)', async () => {
    const { results } = await env.DB.prepare(`PRAGMA table_info(email_send_stats)`).all()
    const cols = results as Array<{ name: string; notnull: number; pk: number; dflt_value: string | null }>
    expect(cols.map(c => c.name).sort()).toEqual(
      ['failed', 'hour', 'last_error', 'last_failed_at', 'last_sent_at', 'provider', 'sent', 'suppressed'])
    expect(cols.find(c => c.name === 'hour')!.pk).toBe(1)
    expect(cols.find(c => c.name === 'provider')!.pk).toBe(2)
    for (const n of ['sent', 'failed', 'suppressed']) {
      expect(cols.find(c => c.name === n)!.notnull).toBe(1)
      expect(cols.find(c => c.name === n)!.dflt_value).toBe('0')
    }
  })

  it('rejects a second row for the same hour and provider', async () => {
    const ins = `INSERT INTO email_send_stats (hour, provider) VALUES ('2026-09-23 20:00:00', 'cloudflare')`
    await env.DB.prepare(ins).run()
    await expect(env.DB.prepare(ins).run()).rejects.toThrow()
  })

  it('creates email_alert_state with status limited to ok and failing', async () => {
    const { results } = await env.DB.prepare(`PRAGMA table_info(email_alert_state)`).all()
    const cols = results as Array<{ name: string; pk: number }>
    expect(cols.map(c => c.name).sort()).toEqual(
      ['failing_since', 'last_alerted_at', 'provider', 'recovered_at', 'status'])
    expect(cols.find(c => c.name === 'provider')!.pk).toBe(1)
    await env.DB.prepare(`INSERT INTO email_alert_state (provider) VALUES ('cloudflare')`).run()
    const row = await env.DB.prepare(`SELECT status FROM email_alert_state WHERE provider = 'cloudflare'`).first()
    expect(row).toEqual({ status: 'ok' })
    await expect(env.DB.prepare(
      `INSERT INTO email_alert_state (provider, status) VALUES ('resend', 'broken')`).run()).rejects.toThrow()
  })
})
