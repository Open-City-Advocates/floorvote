// Regressions from the adversarial review of the dccouncil.gov directory sync.
import { env } from 'cloudflare:test'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { drizzle } from 'drizzle-orm/d1'
import * as schema from '../../src/db/schema-legiscan'
import { setupLsDb } from '../helpers/setupLsDb'
import youthRaw from '../fixtures/dccouncil/committee-youth-affairs.html?raw'
import dirRaw from '../fixtures/dccouncil/council-directory-1.html?raw'
import { syncCouncilDirectory } from '../../src/cron/sync-lims'

// Each directory page gets distinct people, as the real directory has (about 190 across 10 pages).
function pageOf(url: string, html: string): string {
  const n = /\/page\/(\d+)\//.exec(url)?.[1] ?? '1'
  return html.replace(/mailto:([A-Za-z0-9._%+-]+)@dccouncil\.gov/g, `mailto:$1.p${n}@dccouncil.gov`)
}

const fetchMock = vi.fn()
vi.stubGlobal('fetch', fetchMock)

beforeEach(async () => {
  await setupLsDb()
  fetchMock.mockReset()
})

const SLUGS = ['c-one', 'c-two', 'c-three', 'c-four', 'c-five', 'c-six']
const index = `<html><body><main>${SLUGS.map(s => `<a href="https://dccouncil.gov/committees/${s}/">${s}</a>`).join('')}</main></body></html>`
// Two directory pages (80 entries): drop the links to pages 3..10.

function serve(opts: { failSlug?: string; failDirectory?: boolean; youth?: string; directory?: string } = {}) {
  fetchMock.mockImplementation(async (input: RequestInfo | URL) => {
    const url = String(input instanceof Request ? input.url : input)
    if (url === 'https://dccouncil.gov/committees/') return new Response(index, { status: 200 })
    if (opts.failSlug && url.includes(`/committees/${opts.failSlug}/`)) return new Response('bad gateway', { status: 502 })
    if (url.includes('/committees/')) return new Response(opts.youth ?? youthRaw, { status: 200 })
    if (url.includes('/council-directory/')) {
      if (opts.failDirectory) return new Response('down', { status: 503 })
      return new Response(pageOf(url, opts.directory ?? dirRaw), { status: 200 })
    }
    return new Response('not found', { status: 404 })
  })
}

describe('syncCouncilDirectory (review regressions)', () => {
  it('a transient failure on ONE committee page keeps that committee (plausibility guard is only a count)', async () => {
    const db = drizzle(env.DB, { schema })
    serve()
    await syncCouncilDirectory(db)
    expect((await db.select().from(schema.councilCommittees).all()).map(r => r.slug).sort()).toEqual([...SLUGS].sort())
    serve({ failSlug: 'c-three' })
    await syncCouncilDirectory(db)
    const slugs = (await db.select().from(schema.councilCommittees).all()).map(r => r.slug)
    expect(slugs).toContain('c-three')
  }, 60_000)

  it('a directory failure does not discard the fresh committee fetch', async () => {
    const db = drizzle(env.DB, { schema })
    serve()
    await syncCouncilDirectory(db)
    serve({ failDirectory: true, youth: youthRaw.replaceAll('Committee on Youth Affairs', 'Committee on Youth Affairs (renamed)') })
    await syncCouncilDirectory(db).catch(() => {})
    const names = (await db.select().from(schema.councilCommittees).all()).map(r => r.name)
    expect(names.every(n => n.includes('(renamed)'))).toBe(true)
  }, 60_000)

  it('two different staffers who share an office mailbox are both stored', async () => {
    const db = drizzle(env.DB, { schema })
    const card = (name: string, email: string) => `<article class="listing-post listing-grid__card column">
      <p class="h4 byline text-small card-rule">staff</p><h3>${name}</h3>
      <p class="byline">Staff Assistant <br><span class="byline-label">Office:</span> <span class="case-cap">councilmember X</span><br>
      <a href="mailto:${email}"><span class="byline-label">Email: </span>${email}</a><br></p></article>`
    const cards = Array.from({ length: 58 }, (_, i) => card(`Person ${i}`, `p${i}@dccouncil.gov`))
    cards.push(card('Alice Shared', 'ward9@dccouncil.gov'), card('Bob Shared', 'ward9@dccouncil.gov'))
    serve({ directory: `<html><body>${cards.join('\n')}</body></html>` })
    await syncCouncilDirectory(db)
    const names = (await db.select().from(schema.councilDirectory).all()).map(r => r.name)
    expect(names).toContain('Alice Shared')
    expect(names).toContain('Bob Shared')
  }, 60_000)
})
