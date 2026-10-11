import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { EventRules } from './EventRules'
import * as api from '../../lib/api'

const configState = vi.hoisted(() => ({ capabilities: { DC: { bodyEvents: true, deadlines: true } } as Record<string, { bodyEvents: boolean; deadlines: boolean }> }))
vi.mock('../../context/ConfigContext', async (importOriginal) => ({
  ...await importOriginal<typeof import('../../context/ConfigContext')>(),
  useConfig: () => ({ config: { states: ['DC'], capabilities: configState.capabilities }, multiState: false, loading: false }),
}))

const HOUSING = { committeeId: '3000000001', name: 'Committee on Housing', chamber: 'C', state: 'DC' }
const COW = { committeeId: '3000000002', name: 'Committee of the Whole', chamber: 'C', state: 'DC' }
const facets = (o: Record<string, unknown>) => ({ committeeId: null, committee: null, jointWith: null, kind: 'hearing', type: 'Hearing', title: '', topics: [], ...o })
const LOADED = {
  rules: null,
  hasBodyEvents: true,
  committees: [COW, HOUSING],
  kinds: [{ kind: 'hearing', types: ['Hearing', 'Roundtable'] }, { kind: 'meeting', types: ['Meeting'] }],
  events: [
    { id: 'e1', date: '2026-10-12', time: '10:00', description: 'Housing roundtable: Improving Housing Conditions', url: 'https://lims.dccouncil.gov/Hearings/hearings/2408',
      facets: facets({ committeeId: HOUSING.committeeId, committee: HOUSING.name, type: 'Roundtable', title: 'Housing roundtable', topics: ['Improving Housing Conditions'] }), trackedOnAgenda: false, prioritizedOnAgenda: false },
    { id: 'e2', date: '2026-10-13', time: null, description: 'Legislative Meeting', url: null,
      facets: facets({ kind: 'meeting', type: 'Meeting', title: 'Legislative Meeting' }), trackedOnAgenda: false, prioritizedOnAgenda: false },
    { id: 'e3', date: '2026-10-14', time: '10:00', description: 'Committee of the Whole hearing: Soccer Stadium Act', url: null,
      facets: facets({ committeeId: COW.committeeId, committee: COW.name, title: 'Committee of the Whole hearing', topics: ['Soccer Stadium Act'] }), trackedOnAgenda: true, prioritizedOnAgenda: false },
  ],
  optionsError: null,
}

function mockApi(loaded: Record<string, unknown> = {}) {
  return vi.spyOn(api, 'apiFetch').mockImplementation(async (path: string, init?: RequestInit) => {
    if (path === '/admin/event-rules' && !init?.method) return { ...LOADED, ...loaded } as never
    if (path === '/admin/event-rules' && init?.method === 'PUT') {
      const { rules } = JSON.parse(String(init.body)) as { rules: unknown }
      return { rules, shown: rules ? 1 : 3, hidden: rules ? 2 : 0 } as never
    }
    return {} as never
  })
}

const preview = () => screen.getByTestId('event-rules-preview')

describe('Calendar events settings', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
    configState.capabilities = { DC: { bodyEvents: true, deadlines: true } }
  })

  it('shows every event until rules are chosen', async () => {
    mockApi()
    render(<MemoryRouter><EventRules /></MemoryRouter>)
    expect(await screen.findByLabelText('Every event')).toBeChecked()
    expect(within(preview()).getByText(/3 of 3 upcoming events match/)).toBeInTheDocument()
    expect(screen.queryByText('Committee on Housing')).not.toBeInTheDocument()
  })

  it('previews and saves a committee rule', async () => {
    const spy = mockApi()
    render(<MemoryRouter><EventRules /></MemoryRouter>)
    fireEvent.click(await screen.findByLabelText(/Only events matching/))
    fireEvent.click(screen.getByLabelText('Any event whose agenda lists a bill we track'))
    expect(within(preview()).getByText(/0 of 3 upcoming events match/)).toBeInTheDocument()
    fireEvent.click(screen.getByLabelText('Committee on Housing'))
    expect(within(preview()).getByText(/1 of 3 upcoming events matches/)).toBeInTheDocument()
    expect(within(preview()).getByText('Housing roundtable: Improving Housing Conditions')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Save' }))
    await waitFor(() => expect(spy).toHaveBeenCalledWith('/admin/event-rules', expect.objectContaining({ method: 'PUT' })))
    const put = spy.mock.calls.find(([, init]) => init?.method === 'PUT')!
    expect(JSON.parse(String(put[1]!.body))).toEqual({
      rules: { committees: [{ committeeId: HOUSING.committeeId, name: HOUSING.name }], kinds: [], topics: [], trackedBills: false },
    })
    expect(await screen.findByRole('status')).toHaveTextContent('shows 1 of 3 events')
  })

  it('selects by kind, event type, topic, and tracked bills', async () => {
    mockApi({ rules: { committees: [], kinds: [], topics: [], trackedBills: true } })
    render(<MemoryRouter><EventRules /></MemoryRouter>)
    expect(await screen.findByLabelText(/Only events matching/)).toBeChecked()
    expect(within(preview()).getByText(/1 of 3 upcoming events matches/)).toBeInTheDocument()
    fireEvent.click(screen.getByLabelText('All meetings'))
    expect(within(preview()).getByText(/2 of 3 upcoming events match/)).toBeInTheDocument()
    fireEvent.click(screen.getByLabelText('Roundtable'))
    expect(within(preview()).getByText(/3 of 3 upcoming events match/)).toBeInTheDocument()

    fireEvent.click(screen.getByLabelText('All meetings'))
    fireEvent.click(screen.getByLabelText('Roundtable'))
    fireEvent.click(screen.getByLabelText('Any event whose agenda lists a bill we track'))
    fireEvent.click(screen.getByRole('button', { name: 'Add a topic' }))
    fireEvent.change(screen.getByLabelText('Topic 1 name'), { target: { value: 'Housing' } })
    fireEvent.change(screen.getByLabelText('Topic 1 keywords'), { target: { value: 'housing conditions' } })
    expect(within(preview()).getByText(/1 of 3 upcoming events matches/)).toBeInTheDocument()
  })

  it('keeps an event with a prioritized bill on its agenda, whatever the rules say', async () => {
    mockApi({
      rules: { committees: [HOUSING], kinds: [], topics: [], trackedBills: false },
      events: LOADED.events.map(e => e.id === 'e3' ? { ...e, prioritizedOnAgenda: true } : e),
    })
    render(<MemoryRouter><EventRules /></MemoryRouter>)
    expect(await screen.findByText(/2 of 3 upcoming events match/)).toBeInTheDocument()
    expect(within(preview()).getByText(/a prioritized bill is on the agenda/)).toBeInTheDocument()
  })

  it('refuses a topic without keywords', async () => {
    const spy = mockApi({ rules: { committees: [], kinds: [], topics: [], trackedBills: false } })
    render(<MemoryRouter><EventRules /></MemoryRouter>)
    fireEvent.click(await screen.findByRole('button', { name: 'Add a topic' }))
    fireEvent.change(screen.getByLabelText('Topic 1 name'), { target: { value: 'Housing' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))
    expect(await screen.findByRole('status')).toHaveTextContent('needs a name and at least one keyword')
    expect(spy).not.toHaveBeenCalledWith('/admin/event-rules', expect.objectContaining({ method: 'PUT' }))
  })

  it('clears the rules by choosing every event', async () => {
    const spy = mockApi({ rules: { committees: [HOUSING], kinds: [], topics: [], trackedBills: false } })
    render(<MemoryRouter><EventRules /></MemoryRouter>)
    fireEvent.click(await screen.findByLabelText('Every event'))
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))
    await waitFor(() => expect(spy).toHaveBeenCalledWith('/admin/event-rules', { method: 'PUT', body: JSON.stringify({ rules: null }) }))
    expect(await screen.findByRole('status')).toHaveTextContent('shows every event')
  })

  it('says there is nothing to choose when no covered state has body events', async () => {
    configState.capabilities = {}
    mockApi({ hasBodyEvents: false, committees: [], kinds: [], events: [] })
    render(<MemoryRouter><EventRules /></MemoryRouter>)
    expect(await screen.findByText(/nothing to choose here yet/)).toBeInTheDocument()
  })
})
