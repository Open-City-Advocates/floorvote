import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'

const demo = { demoLocked: false }
vi.mock('../hooks/useAuth', () => ({ useAuth: () => ({ user: { id: 'u1', name: 'Alice', role: 'member' }, loading: false }) }))
vi.mock('../context/DemoContext', () => ({ useDemo: () => demo }))

const DIRECTORY = {
  committees: [{
    name: 'Committee on Youth Affairs',
    chair: { name: 'Ward 5 Councilmember Zachary Parker', url: 'https://dccouncil.gov/council/ward-5-councilmember-zachary-parker/' },
    members: [{ name: 'Ward 8 Councilmember Trayon White, Sr.', url: 'https://dccouncil.gov/council/councilmember-trayon-white-sr/' }],
    staff: [{ name: 'Thomas Franco', title: 'Committee Director', email: 'tfranco@dccouncil.gov', phone: '(202) 555-0100', url: null }],
  }],
  people: [{ name: 'Thomas Franco', title: 'Committee Director', office: 'Committee on Youth Affairs', email: 'tfranco@dccouncil.gov', phone: null }],
  councilmembers: [{ name: 'Trayon White, Sr.', role: 'Councilmember', current: true }, { name: 'Kenyan R. McDuffie', role: 'Councilmember', current: false }],
}
const RECORD = {
  person: { personKey: 'cm:trayon white', name: 'Trayon White, Sr.', office: null, owner: { id: 'u2', name: 'Bob' }, stance: 'Open to placement oversight.', updatedBy: { id: 'u2', name: 'Bob' }, updatedAt: '2026-10-01 12:00:00' },
  contacts: [
    { id: 'c1', date: '2026-09-30', kind: 'meeting', summary: 'Met the scheduler.', bill: { id: 'b1', number: 'HN26-0163' }, author: { id: 'u2', name: 'Bob' }, createdAt: '2026-09-30 10:00:00', updatedAt: null },
    { id: 'c2', date: '2026-09-29', kind: 'email', summary: 'Sent the letter.', bill: null, author: { id: 'u1', name: 'Alice' }, createdAt: '2026-09-29 10:00:00', updatedAt: null },
  ],
  followups: [{ id: 'f1', dueDate: '2026-10-05', text: 'Send the redline', owner: { id: 'u1', name: 'Alice' }, author: { id: 'u2', name: 'Bob' }, doneAt: null, doneBy: null }],
}

const calls: { path: string; init?: RequestInit }[] = []
vi.mock('../lib/api', () => ({
  ApiError: class extends Error {},
  apiFetch: vi.fn(async (path: string, init?: RequestInit) => {
    calls.push({ path, init })
    if (path === '/directory') return DIRECTORY
    if (path === '/users') return [{ id: 'u1', name: 'Alice' }, { id: 'u2', name: 'Bob' }]
    if (path === '/calendar/bill-options') return [{ id: 'b1', billNumber: 'HN26-0163', title: 'Roundtable' }]
    if (path.startsWith('/crm/people/') && !init?.method) return path.includes('trayon') ? RECORD : { person: null, contacts: [], followups: [] }
    return { ok: true }
  }),
}))

import { PersonRecord, identify } from './PersonRecord'

function open(key: string) {
  render(<MemoryRouter initialEntries={[`/people/record/${encodeURIComponent(key)}`]}><Routes><Route path="/people/record/:key" element={<PersonRecord />} /></Routes></MemoryRouter>)
}

beforeEach(() => { calls.length = 0; demo.demoLocked = false })

describe('identify', () => {
  it('finds a Councilmember by name across seat titles, with their committees', () => {
    expect(identify(DIRECTORY as any, 'cm:trayon white')).toMatchObject({
      name: 'Trayon White, Sr.', committees: ['Committee on Youth Affairs'], former: false,
      url: 'https://dccouncil.gov/council/councilmember-trayon-white-sr/',
    })
    expect(identify(DIRECTORY as any, 'cm:zachary parker')).toMatchObject({ committees: ['Committee on Youth Affairs (chair)'] })
    expect(identify(DIRECTORY as any, 'cm:kenyan r mcduffie')).toMatchObject({ former: true })
  })

  it('finds a staffer by email, and nobody for an unknown key', () => {
    expect(identify(DIRECTORY as any, 'staff:tfranco@dccouncil.gov')).toMatchObject({ name: 'Thomas Franco', title: 'Committee Director', office: 'Committee on Youth Affairs' })
    expect(identify(DIRECTORY as any, 'staff:nobody@dccouncil.gov')).toBeNull()
  })
})

describe('PersonRecord', () => {
  it('shows the relationship, follow-ups, and contact log, with edit controls only on your own entries', async () => {
    open('cm:trayon white')
    await waitFor(() => expect(screen.getByText('Met the scheduler.')).toBeInTheDocument())
    expect(screen.getByRole('heading', { name: 'Trayon White, Sr.' })).toBeInTheDocument()
    expect(screen.getByText('Open to placement oversight.')).toBeInTheDocument()
    expect(screen.getByText('Send the redline')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'HN26-0163' })).toHaveAttribute('href', '/bills/b1')
    // Alice wrote c2, not c1: one Edit button in the log (plus the stance Edit).
    expect(screen.getAllByRole('button', { name: 'Edit' })).toHaveLength(2)
    // She owns the follow-up, so she can close it.
    expect(screen.getByRole('checkbox')).not.toBeDisabled()
  })

  it('logs a contact with the name the page shows, so a first entry creates the record', async () => {
    open('staff:tfranco@dccouncil.gov')
    await waitFor(() => expect(screen.getByRole('heading', { name: 'Thomas Franco' })).toBeInTheDocument())
    fireEvent.click(screen.getByRole('button', { name: 'Log a contact' }))
    fireEvent.change(screen.getByLabelText('What happened'), { target: { value: 'Called about the roundtable.' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))
    await waitFor(() => expect(calls.some(c => c.init?.method === 'POST')).toBe(true))
    const post = calls.find(c => c.init?.method === 'POST')!
    expect(post.path).toBe('/crm/people/staff%3Atfranco%40dccouncil.gov/contacts')
    expect(JSON.parse(post.init!.body as string)).toMatchObject({ name: 'Thomas Franco', office: 'Committee on Youth Affairs', kind: 'meeting', summary: 'Called about the roundtable.', billId: null })
  })

  it('is read-only in a locked demo', async () => {
    demo.demoLocked = true
    open('cm:trayon white')
    await waitFor(() => expect(screen.getByText('Met the scheduler.')).toBeInTheDocument())
    expect(screen.queryByRole('button', { name: 'Log a contact' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Edit' })).toBeNull()
  })
})
