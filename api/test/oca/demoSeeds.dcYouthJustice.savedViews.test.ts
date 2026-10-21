import { describe, it, expect, beforeEach } from 'vitest'
import { env } from 'cloudflare:test'
import { app } from '../../src/index'
import { clearDb, seedBill, seedSession } from '../helpers'
import { runDemoReset } from '../../src/lib/demoReset'
import { DEMO_SEEDS } from '../../src/lib/demoSeeds'
import { DCYJ_BILLS } from '../../src/oca/demoSeeds/dcYouthJustice/bills'
import { BILL_FILTER_DEFS } from '../../../shared/billFilter'

/**
 * The DC demo's saved views, checked the way test/lib/demoSeeds.savedViews.test.ts
 * checks upstream's: run a real reset, then ask the API which views exist and what
 * each returns. Upstream's file is shaped around its own seed's four views, so the
 * fork keeps its own copy of the checks that apply to any seed.
 *
 * Each bill carries the tags OCA's analysis gave it on 2026-10-16, which the demo
 * copies at standup; the seed writes the priorities, positions, and Lead Committee values.
 */
const DCYJ_TAGS: Record<string, string[]> = {
  'HN26-0083': ['Juvenile Justice', 'DYRS', 'Conditions of Confinement', 'Oversight & Nominations'],
  'HN26-0163': ['Juvenile Justice', 'DYRS', 'Oversight & Nominations'],
  'B26-0286': ['Juvenile Justice', 'Policing'],
  'B26-0355': ['Juvenile Justice', 'Policing'],
  'B26-0404': ['DYRS', 'Conditions of Confinement', 'Behavioral Health'],
  'B26-0526': ['Conditions of Confinement', 'Education & Truancy', 'Youth Charged as Adults', 'Juvenile Justice'],
  'B26-0671': ['Pretrial & Detention', 'Sentencing'],
  'B26-0188': ['Pretrial & Detention', 'Youth Charged as Adults'],
  'B26-0479': ['Juvenile Justice', 'Child Welfare', 'Reentry & Records'],
  'PR26-0764': ['Education & Truancy', 'Conditions of Confinement'],
  'HN26-0088': ['Behavioral Health', 'Oversight & Nominations'],
  'B26-0461': ['Juvenile Justice', 'Policing'],
  'B26-0636': ['Juvenile Justice', 'Policing'],
  'B26-0186': ['Juvenile Justice', 'Pretrial & Detention', 'Education & Truancy', 'Behavioral Health'],
  'B26-0413': ['Juvenile Justice', 'DYRS', 'Budget & Reprogramming'],
  'B26-0038': ['Reentry & Records'],
  'B26-0401': ['Juvenile Justice', 'DYRS', 'Child Welfare', 'Oversight & Nominations'],
  'B26-0402': ['Juvenile Justice', 'Education & Truancy', 'Child Welfare'],
  'REPROG26-0153': ['DYRS', 'Budget & Reprogramming', 'Conditions of Confinement'],
  'B26-0835': ['Policing', 'Pretrial & Detention', 'Violence Prevention'],
}

const FIXTURES = DCYJ_BILLS.map(b => ({ externalId: b.externalId, state: 'DC', tags: DCYJ_TAGS[b.number] }))
const EXPECTED_TOTALS = {
  'dyrs-detention-or-youth-affairs': 11, 'amend-or-oppose-high-or-medium': 6, 'high-priority-no-position': 2,
}
const seed = DEMO_SEEDS['dc-youth-justice']

type ViewDto = { id: string; name: string; query: string; slug: string }

// A fresh session each call: a reset replaces the demo-user row, which takes the sessions this test minted with it.
async function demoUserCookie(): Promise<string> {
  return `session=${await seedSession('demo-user')}`
}

async function listViews(): Promise<ViewDto[]> {
  const res = await app.request('/api/views', { headers: { Cookie: await demoUserCookie() } }, env)
  expect(res.status).toBe(200)
  return ((await res.json()) as { views: ViewDto[] }).views
}

async function totalFor(query: string): Promise<number> {
  const res = await app.request(`/api/bills?${query}`, { headers: { Cookie: await demoUserCookie() } }, env)
  expect(res.status, query).toBe(200)
  return ((await res.json()) as { pagination: { total: number } }).pagination.total
}

/** An OR view, split into one query per filter dimension. Null for any view that is not `match=any` across at least two dimensions. */
function orDimensions(query: string): Array<{ key: string; query: string }> | null {
  const p = new URLSearchParams(query)
  if (p.get('match') !== 'any') return null
  const byKey = new Map<string, string[]>()
  for (const [k, v] of p) {
    if (k === 'match') continue
    byKey.set(k, [...(byKey.get(k) ?? []), v])
  }
  if (byKey.size < 2) return null
  return [...byKey].map(([key, values]) => ({
    key, query: new URLSearchParams(values.map((v): [string, string] => [key, v])).toString(),
  }))
}

describe('saved views in the dc-youth-justice demo seed', () => {
  beforeEach(async () => {
    await clearDb()
    for (const [i, f] of FIXTURES.entries()) {
      await seedBill({ externalId: f.externalId, billNumber: `B${1000 + i}`, title: `Bill ${i}`, state: f.state, tags: f.tags })
    }
    // Every bill the seed's own rows point at must exist, or the reset's guards would no-op.
    expect(new Set(FIXTURES.map(f => f.externalId))).toEqual(new Set(seed.priorities.map(p => p.externalId)))
    await runDemoReset(env.DB, seed)
  })

  it('creates exactly three views, each with a name and a filter', async () => {
    const views = await listViews()
    expect(views).toHaveLength(3)
    for (const v of views) {
      expect(v.name.trim().length).toBeGreaterThan(0)
      expect(v.query.trim().length).toBeGreaterThan(0)
    }
  })

  it('has one OR view, and combines several filters in the others', async () => {
    const views = await listViews()
    expect(views.filter(v => orDimensions(v.query) !== null)).toHaveLength(1)
    for (const v of views.filter(v => orDimensions(v.query) === null)) {
      expect(new Set(new URLSearchParams(v.query).keys()).size, `${v.name} (${v.query}) filters on one dimension`).toBeGreaterThanOrEqual(2)
    }
  })

  it('uses no subject filter, and writes no subjects of its own', async () => {
    for (const v of await listViews()) {
      expect([...new URLSearchParams(v.query).keys()], `${v.name} (${v.query})`).not.toContain('subject')
    }
    const stored = await env.DB.prepare('SELECT count(*) AS n FROM bill_subjects').first<{ n: number }>()
    expect(stored!.n).toBe(0)
  })

  it('returns bills from every dimension of the OR view, each on its own', async () => {
    for (const v of (await listViews()).filter(v => orDimensions(v.query) !== null)) {
      for (const { key, query } of orDimensions(v.query)!) {
        expect(await totalFor(query), `${v.name}: ${key} alone (${query})`).toBeGreaterThanOrEqual(1)
      }
    }
  })

  // Dropping any one dimension of a combined view must widen the result, or that filter is decoration.
  it('has no decorative filter in a combined view', async () => {
    for (const v of (await listViews()).filter(v => orDimensions(v.query) === null)) {
      const p = new URLSearchParams(v.query)
      const total = await totalFor(v.query)
      for (const key of new Set(p.keys())) {
        const without = new URLSearchParams([...p].filter(([k]) => k !== key)).toString()
        expect(await totalFor(without), `${v.name}: dropping ${key} changes nothing`).toBeGreaterThan(total)
      }
    }
  })

  it('returns the number of bills the seed says each view does', async () => {
    const got = Object.fromEntries(await Promise.all(
      (await listViews()).map(async v => [v.slug, await totalFor(v.query)] as const),
    ))
    expect(got).toEqual(EXPECTED_TOTALS)
  })

  // One name per filter (#699): a custom field's key is `field.<slug>`. An old `cf_<slug>` key would be ignored.
  it('writes every view with the bill filter\'s keys', async () => {
    const names = new Set<string>(BILL_FILTER_DEFS.map(d => d.name).filter(n => n !== 'field'))
    for (const v of await listViews()) {
      for (const key of new URLSearchParams(v.query).keys()) {
        expect(names.has(key) || key.startsWith('field.'), `${v.name}: ${key}`).toBe(true)
      }
    }
  })

  it('restores the views and keeps their ids and slugs on the next reset', async () => {
    const before = await listViews()
    await env.DB.prepare('DELETE FROM saved_views WHERE id = ?').bind(before[0].id).run()
    await env.DB.prepare(`UPDATE saved_views SET query = 'search=nothing' WHERE id = ?`).bind(before[1].id).run()
    await runDemoReset(env.DB, seed)
    expect(await listViews()).toEqual(before)
  })
})
