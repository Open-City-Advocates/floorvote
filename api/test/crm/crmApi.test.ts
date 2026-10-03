import { describe, it, expect, beforeEach } from 'vitest'
import { env } from 'cloudflare:test'
import { resetDb, applyMigrations, seedUser, seedSession, seedBill } from '../helpers'
import { app } from '../../src/index'
import { councilmemberKey, isPersonKey, nameKey, staffKey } from '../../../shared/crmKeys'

const call = (path: string, init?: RequestInit) => app.request(path, init, env)
const json = (method: string, cookie: string, body?: unknown): RequestInit => ({
  method, headers: { Cookie: cookie, 'Content-Type': 'application/json' }, ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
})

const TRAYON = councilmemberKey('Ward 8 Councilmember Trayon White, Sr.')
const path = (k: string) => `/api/crm/people/${encodeURIComponent(k)}`

let alice: string, bob: string, admin: string, aliceId: string, bobId: string, gone: string
beforeEach(async () => {
  await resetDb()
  await applyMigrations()
  aliceId = await seedUser({ role: 'member', email: 'alice@example.com', name: 'Alice' })
  bobId = await seedUser({ role: 'member', email: 'bob@example.com', name: 'Bob' })
  gone = await seedUser({ role: 'member', email: 'gone@example.com', name: 'Gone', deactivatedAt: '2026-01-01 00:00:00' })
  alice = `session=${await seedSession(aliceId)}`
  bob = `session=${await seedSession(bobId)}`
  admin = `session=${await seedSession(await seedUser({ role: 'admin', email: 'admin@example.com', name: 'Admin' }))}`
})

describe('CRM keys', () => {
  it('key a Councilmember by name across seat titles and suffixes, and staff by email', () => {
    expect(nameKey('Ward 8 Councilmember Trayon White, Sr.')).toBe('trayon white')
    expect(councilmemberKey('Trayon White, Sr.')).toBe(TRAYON)
    expect(councilmemberKey('At-Large Councilmember Robert C. White, Jr.')).toBe('cm:robert c white')
    expect(councilmemberKey('Chairman Phil Mendelson')).toBe('cm:phil mendelson')
    expect(staffKey({ email: 'TFranco@dccouncil.gov', name: 'Thomas Franco', office: 'x' })).toBe('staff:tfranco@dccouncil.gov')
    expect(staffKey({ email: null, name: 'Ana Pérez', office: 'Councilmember Pinto' })).toBe('staff:ana perez|councilmember pinto')
    expect(isPersonKey(TRAYON)).toBe(true)
    expect(isPersonKey('staff:tfranco@dccouncil.gov')).toBe(true)
    expect(isPersonKey('cm:<script>')).toBe(false)
    expect(isPersonKey('bill:1')).toBe(false)
  })
})

describe('CRM records', () => {
  it('any member logs a contact; the record is created from the name and office shown', async () => {
    const bill = await seedBill({ billNumber: 'B26-0671', state: 'DC' })
    const res = await call(`${path(TRAYON)}/contacts`, json('POST', alice, {
      name: 'Trayon White, Sr.', office: 'Ward 8', date: '2026-09-30', kind: 'meeting', summary: 'Met with the Ward 8 office about DYRS placement rules.', billId: bill,
    }))
    expect(res.status).toBe(201)
    const rec = await (await call(path(TRAYON), { headers: { Cookie: bob } })).json() as any
    expect(rec.person).toMatchObject({ name: 'Trayon White, Sr.', office: 'Ward 8', owner: null })
    expect(rec.contacts).toEqual([expect.objectContaining({
      date: '2026-09-30', kind: 'meeting', bill: { id: bill, number: 'B26-0671' }, author: { id: aliceId, name: 'Alice' },
    })])
  })

  it('rejects bad input', async () => {
    const ok = { name: 'Trayon White, Sr.', date: '2026-09-30', kind: 'call', summary: 'Called.' }
    expect((await call(`${path(TRAYON)}/contacts`, json('POST', alice, { ...ok, date: '9/30/2026' }))).status).toBe(400)
    expect((await call(`${path(TRAYON)}/contacts`, json('POST', alice, { ...ok, kind: 'lunch' }))).status).toBe(400)
    expect((await call(`${path(TRAYON)}/contacts`, json('POST', alice, { ...ok, summary: '  ' }))).status).toBe(400)
    expect((await call(`${path(TRAYON)}/contacts`, json('POST', alice, { ...ok, billId: 'nope' }))).status).toBe(400)
    expect((await call(`${path(TRAYON)}/contacts`, json('POST', alice, { ...ok, name: '' }))).status).toBe(400)
    expect((await call(`/api/crm/people/${encodeURIComponent('cm:<b>')}/contacts`, json('POST', alice, ok))).status).toBe(404)
    expect((await call(path(TRAYON))).status).toBe(401)
  })

  it('only the author or an admin changes or deletes a contact', async () => {
    const { id } = await (await call(`${path(TRAYON)}/contacts`, json('POST', alice, { name: 'Trayon White, Sr.', date: '2026-09-30', kind: 'call', summary: 'Called.' }))).json() as any
    expect((await call(`/api/crm/contacts/${id}`, json('PATCH', bob, { summary: 'Edited by Bob' }))).status).toBe(403)
    expect((await call(`/api/crm/contacts/${id}`, json('DELETE', bob))).status).toBe(403)
    expect((await call(`/api/crm/contacts/${id}`, json('PATCH', alice, { summary: 'Called the scheduler.' }))).status).toBe(200)
    const rec = await (await call(path(TRAYON), { headers: { Cookie: alice } })).json() as any
    expect(rec.contacts[0]).toMatchObject({ summary: 'Called the scheduler.', kind: 'call' })
    expect(rec.contacts[0].updatedAt).toBeTruthy()
    expect((await call(`/api/crm/contacts/${id}`, json('DELETE', admin))).status).toBe(204)
  })

  it('any member sets the relationship owner and stance; the owner must be a current member', async () => {
    expect((await call(path(TRAYON), json('PUT', bob, { name: 'Trayon White, Sr.', ownerId: aliceId, stance: 'Supportive on placement oversight.' }))).status).toBe(200)
    expect((await call(path(TRAYON), json('PUT', bob, { ownerId: gone }))).status).toBe(400)
    const rec = await (await call(path(TRAYON), { headers: { Cookie: alice } })).json() as any
    expect(rec.person).toMatchObject({ owner: { id: aliceId, name: 'Alice' }, stance: 'Supportive on placement oversight.', updatedBy: { id: bobId, name: 'Bob' } })
    expect((await call(path(TRAYON), json('PUT', alice, { ownerId: null }))).status).toBe(200)
    expect(((await (await call(path(TRAYON), { headers: { Cookie: alice } })).json()) as any).person.owner).toBeNull()
  })

  it('follow-ups: assigned to their author by default, closable by the owner, listed soonest first', async () => {
    const staff = 'staff:tfranco@dccouncil.gov'
    await call(`${path(staff)}/followups`, json('POST', alice, { name: 'Thomas Franco', office: 'Committee on Youth Affairs', text: 'Send the redline', dueDate: '2026-10-05', ownerId: bobId }))
    await call(`${path(TRAYON)}/followups`, json('POST', alice, { name: 'Trayon White, Sr.', text: 'Ask for a meeting', dueDate: '2026-10-03' }))
    await call(`${path(TRAYON)}/followups`, json('POST', alice, { name: 'Trayon White, Sr.', text: 'No date' }))
    const all = await (await call('/api/crm/followups?scope=all', { headers: { Cookie: bob } })).json() as any
    expect(all.followups.map((f: any) => f.text)).toEqual(['Ask for a meeting', 'Send the redline', 'No date'])
    expect(all.followups[0].owner).toEqual({ id: aliceId, name: 'Alice' })
    const mine = await (await call('/api/crm/followups?scope=mine', { headers: { Cookie: bob } })).json() as any
    expect(mine.followups.map((f: any) => f.text)).toEqual(['Send the redline'])

    const redline = mine.followups[0].id
    expect((await call(`/api/crm/followups/${redline}`, json('PATCH', bob, { text: 'Changed' }))).status).toBe(403)
    expect((await call(`/api/crm/followups/${redline}`, json('PATCH', bob, { done: true }))).status).toBe(200)
    expect(((await (await call('/api/crm/followups', { headers: { Cookie: bob } })).json()) as any).followups.map((f: any) => f.text)).toEqual(['Ask for a meeting', 'No date'])
    expect((await call(`/api/crm/followups/${redline}`, json('PATCH', alice, { dueDate: 'soon' }))).status).toBe(400)
    expect((await call(`/api/crm/followups/${redline}`, json('DELETE', bob))).status).toBe(403)
    expect((await call(`/api/crm/followups/${redline}`, json('DELETE', alice))).status).toBe(204)
  })

  it('summarises each record for the People page', async () => {
    await call(`${path(TRAYON)}/contacts`, json('POST', alice, { name: 'Trayon White, Sr.', date: '2026-09-01', kind: 'email', summary: 'a' }))
    await call(`${path(TRAYON)}/contacts`, json('POST', alice, { name: 'Trayon White, Sr.', date: '2026-09-30', kind: 'call', summary: 'b' }))
    await call(`${path(TRAYON)}/followups`, json('POST', alice, { name: 'Trayon White, Sr.', text: 'c' }))
    const { people } = await (await call('/api/crm/people', { headers: { Cookie: bob } })).json() as any
    expect(people).toEqual([expect.objectContaining({ personKey: TRAYON, lastContact: '2026-09-30', openFollowups: 1 })])
  })
})
