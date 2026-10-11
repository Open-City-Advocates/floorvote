import { env } from 'cloudflare:test'
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('../../src/lib/rateLimitedFetch', () => import('../helpers/unpacedFetch'))

import { drizzle } from 'drizzle-orm/d1'
import { eq } from 'drizzle-orm'
import * as schema from '../../src/db/schema'
import * as oca from '../../src/oca/schema'
import { setupLsDb } from '../helpers/setupLsDb'
import { refreshTerms, runDcDirectory } from '../../src/oca/directory'
import { isTenantSurfaceAllowed } from '../../src/lib/tenantSurface'
import { app } from '../../src/index-legiscan'

// The fork's term refresh and directory route on upstream central, where
// LIMS's provider owns DC's people and the fork writes only its own columns.

const fetchMock = vi.fn()
vi.stubGlobal('fetch', fetchMock)
const SECRET = 'test-secret'

const CP26 = 1_000_000_026
let members: { id: number; name: string; startDate: string | null; endDate: string | null }[]

beforeEach(async () => {
  await setupLsDb()
  fetchMock.mockReset()
  members = [
    { id: 194, name: 'Zachary Parker', startDate: '2025-01-02T00:00:00', endDate: '2029-01-02T00:00:00' },
    { id: 192, name: 'Kenyan R. McDuffie', startDate: '2025-01-02T00:00:00', endDate: '2029-01-02T00:00:00' },
  ]
  fetchMock.mockImplementation(async (input: RequestInfo | URL) => {
    const url = String(input instanceof Request ? input.url : input)
    if (url === 'https://lims.dccouncil.gov/api/v2/PublicData/Members/26') return Response.json(members)
    return new Response('not found', { status: 404 })
  })
  const db = drizzle(env.DB, { schema })
  await db.insert(schema.sessions).values({
    sessionId: CP26, state: 'DC', stateId: 51, yearStart: 2025, yearEnd: 2026,
    sessionName: '2025-2026 Council Period 26', sessionTitle: 'CP26', prior: 0, provider: 'lims',
  })
  // Upstream's LIMS provider writes DC's people; LegiScan's own rows sit beside them.
  await db.insert(schema.people).values([
    { peopleId: 1_000_000_194, name: 'Zachary Parker', role: 'Councilmember', provider: 'lims' },
    { peopleId: 1_000_000_192, name: 'Kenyan R. McDuffie', role: 'Councilmember', provider: 'lims' },
    { peopleId: 4242, name: 'A LegiScan Legislator', provider: 'legiscan' },
  ])
})

const person = async (id: number) => (await drizzle(env.DB, { schema }).select().from(oca.councilPeople).where(eq(oca.councilPeople.peopleId, id)).get())!

describe('the term refresh', () => {
  it('writes LIMS term dates on LIMS\'s people only, and sets a baseline before it logs changes', async () => {
    const db = drizzle(env.DB, { schema })
    expect(await refreshTerms('key', db, '2026-10-11')).toBe(1)
    expect(await person(1_000_000_194)).toMatchObject({ termStart: '2025-01-02', termEnd: '2029-01-02', name: 'Zachary Parker' })
    expect(await person(4242)).toMatchObject({ termStart: null, termEnd: null })
    // The first run with term dates is a baseline, not a Council of newcomers.
    expect(await db.select().from(oca.councilChanges).all()).toEqual([])

    // A member's term ends early: the next run logs it.
    members[1] = { ...members[1], endDate: '2026-10-01T00:00:00' }
    await refreshTerms('key', db, '2026-10-11')
    expect((await person(1_000_000_192)).termEnd).toBe('2026-10-01')
    expect((await db.select().from(oca.councilChanges).all()).map(c => c.person)).toContain('Kenyan R. McDuffie')
  })

  it('does nothing until LIMS holds DC', async () => {
    const db = drizzle(env.DB, { schema })
    await db.update(schema.sessions).set({ provider: 'legiscan' }).where(eq(schema.sessions.sessionId, CP26))
    expect(await runDcDirectory({ ...(env as any), LIMS_API_KEY: 'key' }, db, { force: true })).toBeNull()
    expect(fetchMock).not.toHaveBeenCalled()
    expect(await runDcDirectory({ ...(env as any), LIMS_API_KEY: undefined }, db, { force: true })).toBeNull()
  })
})

describe('GET /api/bills/council-directory', () => {
  it('answers ahead of upstream\'s /bills/:id, with the current Council\'s terms', async () => {
    await refreshTerms('key', drizzle(env.DB, { schema }), '2026-10-11')
    const res = await app.fetch(new Request('http://central/api/bills/council-directory', { headers: { 'x-admin-secret': SECRET } }), { ...(env as any), ADMIN_SECRET: SECRET })
    expect(res.status).toBe(200)
    const body = await res.json() as { councilmembers: { name: string; current: boolean }[] }
    expect(body.councilmembers.map(m => m.name).sort()).toEqual(['Kenyan R. McDuffie', 'Zachary Parker'])
    expect(body.councilmembers.every(m => m.current)).toBe(true)
  })

  it('is open to instances through TenantApi, and to no one without the secret', async () => {
    expect(isTenantSurfaceAllowed('GET', '/api/bills/council-directory')).toBe(true)
    const res = await app.fetch(new Request('http://central/api/bills/council-directory'), { ...(env as any), ADMIN_SECRET: SECRET })
    expect(res.status).toBe(401)
  })
})
