import { describe, it, expect, beforeEach } from 'vitest'
import { env } from 'cloudflare:test'
import { resetDb, applyMigrations, seedBill } from '../helpers'
import { runDemoReset } from '../../src/lib/demoReset'
import { resolveDemoSeed } from '../../src/lib/demoSeeds'
import { DCYJ_BILLS, DCYJ_HEARING_NOTICE_SOURCES } from '../../src/oca/demoSeeds/dcYouthJustice/bills'
import { DCYJ_USER_ROLES } from '../../src/oca/demoSeeds/dcYouthJustice/roster'
import {
  stripHtml, COMMENT_PREVIEW_MAX, PASSIVE_EVENT_TYPES, type FeedEvent,
} from '../../../shared/feedUtils'
import { REACTION_EMOJIS } from '../../../shared/reactionEmojis'

// Resolving through upstream's registry also proves the one-line hook in
// api/src/lib/demoSeeds/index.ts survived the last upstream merge.
const s = resolveDemoSeed('dc-youth-justice')
const billIds = new Set(s.priorities.map(p => p.externalId))
const userById = new Map(s.users.map(u => [u.id, u]))
const admins = new Set(s.users.filter(u => u.role !== 'member').map(u => u.id))

describe('dc-youth-justice registration', () => {
  it('is registered through the fork hook', () => {
    expect(s.slug).toBe('dc-youth-justice')
  })

  it('names the organization without the Demo prefix (the machinery adds it)', () => {
    expect(s.associationName).toBe('Ward to Ward Youth Justice Alliance')
  })

  it('is a STATE-scoped seed with no coverage list', () => {
    expect(s.stateCoverage).toBeNull()
  })

  it('tells the visitor what is real, what is fictional, and that changes reset', () => {
    expect(s.bannerText).toMatch(/real/i)
    expect(s.bannerText).toMatch(/fictional/i)
    expect(s.bannerText).toMatch(/reset/i)
  })

  it('ships no keyword that is empty or duplicated', () => {
    expect(s.keywords.every(k => k.trim().length > 0)).toBe(true)
    expect(new Set(s.keywords).size).toBe(s.keywords.length)
  })
})

describe('dc-youth-justice roster', () => {
  it('has the shared demo visitor account, as an admin', () => {
    expect(userById.get('demo-user')?.role).toBe('admin')
  })

  it('puts everyone on exactly one watch team', () => {
    const watch = new Set(s.roles.filter(r => r.name.endsWith('Watch')).map(r => r.id))
    for (const u of s.users) {
      const n = DCYJ_USER_ROLES.filter(ur => ur.userId === u.id && watch.has(ur.roleId)).length
      expect(n, `${u.id} watch teams`).toBe(1)
    }
  })

  it('references only real user and role ids in userRoles', () => {
    const rids = new Set(s.roles.map(r => r.id))
    for (const ur of s.userRoles) {
      expect(userById.has(ur.userId), ur.userId).toBe(true)
      expect(rids.has(ur.roleId), ur.roleId).toBe(true)
    }
  })

  it('gives dropdowns options and non-dropdowns none', () => {
    for (const f of s.customFields) {
      if (f.type === 'dropdown') expect(f.options?.length, f.id).toBeGreaterThan(0)
      else expect(f.options, f.id).toBeNull()
    }
  })
})

describe('dc-youth-justice measures', () => {
  // central/src/providers/lims/ids.ts, restated: a test cannot import central.
  const PREFIXES = ['B', 'PR', 'CER', 'CA', 'GBM', 'REPROG', 'HFA', 'HN', 'HR', 'RC', 'ANC', 'AU', 'CFO', 'IG', 'AG']
  const limsHandle = (number: string) => {
    const m = /^([A-Z]+)(\d{1,2})-(\d{1,5})$/.exec(number)!
    return `legiscan:${1_000_000_000 + (PREFIXES.indexOf(m[1]) + 1) * 10_000_000 + Number(m[2]) * 100_000 + Number(m[3])}`
  }

  it('tracks 20 distinct measures, each with a priority', () => {
    expect(DCYJ_BILLS).toHaveLength(20)
    expect(billIds.size).toBe(20)
  })

  it("addresses each measure by the handle central mints for its LIMS number", () => {
    for (const b of DCYJ_BILLS) expect(b.externalId, b.number).toBe(limsHandle(b.number))
  })

  it("keeps OCA's eleven priorities at OCA's own level", () => {
    const oca: Record<string, string> = {
      'HN26-0083': 'high', 'HN26-0163': 'high',
      'B26-0286': 'medium', 'B26-0355': 'medium', 'B26-0404': 'medium', 'B26-0526': 'medium', 'B26-0671': 'medium',
      'B26-0188': 'low', 'B26-0479': 'low', 'PR26-0764': 'low', 'HN26-0088': 'low',
    }
    for (const [number, priority] of Object.entries(oca)) {
      expect(DCYJ_BILLS.find(b => b.number === number)?.priority, number).toBe(priority)
    }
  })

  it('has positions set only by admins, in the seed vocabulary', () => {
    for (const p of s.positions) {
      expect(admins.has(p.setBy), `${p.id} set by ${p.setBy}`).toBe(true)
      expect(s.positionVocabulary).toContain(p.position)
    }
  })

  it('uses only defined custom fields and valid dropdown options', () => {
    const fields = new Map(s.customFields.map(f => [f.id, f]))
    for (const v of s.customFieldValues) {
      const f = fields.get(v.fieldId)
      expect(f, v.fieldId).toBeDefined()
      expect(billIds.has(v.externalId), `${v.fieldId} on ${v.externalId}`).toBe(true)
      if (f!.type === 'dropdown') expect(f!.options).toContain(v.value)
      if (f!.type === 'date') expect(v.value).toMatch(/^\d{4}-\d{2}-\d{2}$/)
    }
  })

  it('links every bill-linked calendar row to a tracked measure', () => {
    for (const e of s.calendarEvents) {
      if (e.externalId !== null) expect(billIds.has(e.externalId), e.id).toBe(true)
      if (e.source === 'hearing') expect(e.externalId, `${e.id} hearing without a measure`).not.toBeNull()
    }
  })

  it('details each hearing notice straight from its calendar row', () => {
    for (const n of DCYJ_HEARING_NOTICE_SOURCES) {
      const ev = s.feedEvents.find(e => e.id === n.eventId)!
      const cal = s.calendarEvents.find(e => e.id === n.calendarId)!
      expect(ev.externalId).toBe(cal.externalId)
      expect(ev.metadata).toEqual({ time: cal.time, location: cal.location, description: cal.description })
    }
  })
})

describe('dc-youth-justice discussion', () => {
  it('resolves every comment, reaction, mention, vote, and note reference', () => {
    const cids = new Set(s.comments.map(c => c.id))
    for (const c of s.comments) {
      expect(userById.has(c.userId), `comment ${c.id} user`).toBe(true)
      expect(billIds.has(c.externalId), `comment ${c.id} bill`).toBe(true)
    }
    for (const r of s.reactions) expect(cids.has(r.commentId), `reaction ${r.id}`).toBe(true)
    for (const m of s.mentions) expect(cids.has(m.commentId), `mention ${m.id}`).toBe(true)
    for (const v of s.votes) expect(billIds.has(v.externalId), `vote ${v.id}`).toBe(true)
    for (const n of s.notes) expect(billIds.has(n.externalId), `note ${n.id}`).toBe(true)
  })

  it('covers every measure with at least three comments', () => {
    for (const p of s.priorities) {
      expect(s.comments.filter(c => c.externalId === p.externalId).length, p.externalId).toBeGreaterThanOrEqual(3)
    }
  })

  it('keeps every comment inside the feed preview, as conversation', () => {
    for (const c of s.comments) {
      const text = stripHtml(c.content)
      expect(text.length, `${c.id}: ${text}`).toBeLessThanOrEqual(COMMENT_PREVIEW_MAX)
      expect(c.content).not.toContain('<ul>')
      expect(c.content).not.toContain('<strong>')
    }
  })

  it('never has anyone act before they joined', () => {
    const joined = (id: string) => userById.get(id)!.createdDaysAgo
    for (const c of s.comments) expect(c.daysAgo, `${c.id}`).toBeLessThanOrEqual(joined(c.userId))
    for (const v of s.votes) expect(v.daysAgo, `${v.id}`).toBeLessThanOrEqual(joined(v.userId))
    for (const r of s.reactions) expect(r.daysAgo, `${r.id}`).toBeLessThanOrEqual(joined(r.userId))
    for (const p of s.positions) expect(p.daysAgo, `${p.id}`).toBeLessThanOrEqual(joined(p.setBy))
    for (const v of s.customFieldValues) expect(v.daysAgo, `${v.fieldId}`).toBeLessThanOrEqual(joined(v.setBy))
    for (const b of DCYJ_BILLS) expect(b.prioritySetDaysAgo, b.number).toBeLessThanOrEqual(joined(b.prioritySetBy))
  })

  it('never lets a reaction predate its comment, or repeat', () => {
    const byId = new Map(s.comments.map(c => [c.id, c]))
    for (const r of s.reactions) expect(r.daysAgo, r.id).toBeLessThanOrEqual(byId.get(r.commentId)!.daysAgo)
    expect(new Set(s.reactions.map(r => `${r.commentId}|${r.userId}|${r.emoji}`)).size).toBe(s.reactions.length)
  })

  it('reacts with the picker set, and with more than agreement', () => {
    for (const r of s.reactions) expect(REACTION_EMOJIS as readonly string[]).toContain(r.emoji)
    const used = new Set(s.reactions.map(r => r.emoji))
    expect(used.size).toBeGreaterThanOrEqual(5)
    expect(used.has('😭')).toBe(true)
  })

  it('has one vote per member per measure, none from a non-voter, and all three positions', () => {
    expect(new Set(s.votes.map(v => `${v.externalId}|${v.userId}`)).size).toBe(s.votes.length)
    for (const v of s.votes) expect(userById.get(v.userId)!.canVote, v.id).toBe(true)
    for (const p of ['support', 'oppose', 'neutral']) expect(s.votes.some(v => v.position === p), p).toBe(true)
  })
})

describe('dc-youth-justice mentions', () => {
  const spans = (html: string) => [...html.matchAll(/data-id="(user|role):([^"]+)"/g)].map(m => [m[1], m[2]])

  it('never notifies a comment author of their own comment', () => {
    const byId = new Map(s.comments.map(c => [c.id, c]))
    for (const m of s.mentions) expect(m.userId, m.id).not.toBe(byId.get(m.commentId)!.userId)
  })

  it('fans a role mention out to every member but the author', () => {
    for (const c of s.comments) {
      for (const [type, id] of spans(c.content)) {
        if (type !== 'role') continue
        const expected = DCYJ_USER_ROLES.filter(ur => ur.roleId === id && ur.userId !== c.userId).map(ur => ur.userId).sort()
        const actual = s.mentions.filter(m => m.commentId === c.id && m.sourceId === id).map(m => m.userId).sort()
        expect(actual, `${c.id} @${id}`).toEqual(expected)
      }
    }
  })

  it("keeps the demo visitor's bell populated and recent", () => {
    const bell = s.mentions.filter(m => m.userId === 'demo-user')
    expect(bell.length).toBeGreaterThanOrEqual(3)
    for (const m of bell) expect(m.daysAgo, m.id).toBeLessThanOrEqual(14)
  })
})

describe('dc-youth-justice feed', () => {
  it('gives every feed event a unique id and a tracked measure', () => {
    expect(new Set(s.feedEvents.map(e => e.id)).size).toBe(s.feedEvents.length)
    for (const e of s.feedEvents) expect(billIds.has(e.externalId), e.id).toBe(true)
  })

  it('mixes real legislative activity with discussion in the last two weeks', () => {
    const recent = s.feedEvents.filter(e => e.daysAgo <= 14)
    expect(recent.some(e => PASSIVE_EVENT_TYPES.has(e.type as FeedEvent['type']))).toBe(true)
    expect(recent.some(e => e.type === 'comment_added')).toBe(true)
  })

  it('has at least four bill-day groups in the last 72 hours', () => {
    const groups = new Set(s.feedEvents.filter(e => e.daysAgo <= 3).map(e => `${e.externalId}::${e.daysAgo}`))
    expect(groups.size).toBeGreaterThanOrEqual(4)
  })
})

const count = async (t: string) =>
  (await env.DB.prepare(`SELECT count(*) AS n FROM ${t}`).first<{ n: number }>())?.n ?? 0

describe('runDemoReset with the dc-youth-justice seed', () => {
  beforeEach(async () => {
    await resetDb()
    await applyMigrations()
    for (const b of DCYJ_BILLS) {
      await seedBill({ externalId: b.externalId, billNumber: b.number, title: b.number, state: 'DC', priority: null })
    }
  })

  it('installs every row, dropping none through the bill guard', async () => {
    await runDemoReset(env.DB, s)
    const checks: Array<[string, number]> = [
      ['users', s.users.length], ['roles', s.roles.length],
      ['comments', s.comments.length], ['comment_reactions', s.reactions.length],
      ['notifications', s.mentions.length], ['member_votes', s.votes.length],
      ['official_positions', s.positions.length], ['bill_custom_field_values', s.customFieldValues.length],
      ['feed_events', s.feedEvents.length], ['calendar_events', s.calendarEvents.length], ['notes', s.notes.length],
    ]
    for (const [table, expected] of checks) {
      const actual = await count(table)
      expect(actual, `${table}: expected ${expected}, got ${actual}`).toBe(expected)
    }
    const unprioritized = await env.DB.prepare('SELECT count(*) AS n FROM bills WHERE priority IS NULL').first<{ n: number }>()
    expect(unprioritized!.n).toBe(0)
  })

  // The summaries are copied in once at standup (tools/demo/copy-summaries.py in
  // floorvote-deploy); a reset that touched them would leave the demo with bare
  // bills six hours after launch.
  it('leaves copied analysis alone across resets', async () => {
    const ext = DCYJ_BILLS[0].externalId
    await env.DB.prepare(
      `UPDATE bills SET tenant_summary = 'Copied summary.', tags = '["DYRS"]', relevance_score = 9 WHERE external_id = ?`
    ).bind(ext).run()
    await runDemoReset(env.DB, s)
    await runDemoReset(env.DB, s)
    const row = await env.DB.prepare('SELECT tenant_summary, tags, relevance_score FROM bills WHERE external_id = ?')
      .bind(ext).first<{ tenant_summary: string; tags: string; relevance_score: number }>()
    expect(row).toEqual({ tenant_summary: 'Copied summary.', tags: '["DYRS"]', relevance_score: 9 })
  })

  it('is idempotent', async () => {
    await runDemoReset(env.DB, s)
    await runDemoReset(env.DB, s)
    expect(await count('comments')).toBe(s.comments.length)
    expect(await count('notifications')).toBe(s.mentions.length)
    expect(await count('feed_events')).toBe(s.feedEvents.length)
  })
})
