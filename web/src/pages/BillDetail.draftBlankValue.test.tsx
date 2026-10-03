import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { BillDetail } from './BillDetail'
import * as api from '../lib/api'

// The draft bill-number and State inline editors refuse a blank value. Saving
// one blank must say why (an inline "... is required" message, announced to
// screen readers and tied to the field), keep the editor open, and send
// nothing. Harness mirrors BillDetail.draftState.test.tsx.
const navigateMock = vi.hoisted(() => vi.fn())
const routerMock = vi.hoisted(() => ({
  params: { billId: '42' } as Record<string, string | undefined>,
  location: { state: null as unknown, pathname: '/bills/42', hash: '', search: '' },
  loaderData: null as unknown,
}))
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom')
  return {
    ...actual,
    useParams: () => routerMock.params,
    useNavigate: () => navigateMock,
    useNavigation: () => ({ state: 'idle' }),
    useLocation: () => routerMock.location,
    useLoaderData: () => routerMock.loaderData,
  }
})

vi.mock('../lib/scrollUtils', () => ({ getScrollContainer: () => ({ scrollTo: vi.fn() }) }))
vi.mock('../components/RichTextEditor', () => ({ RichTextEditor: () => null }))
vi.mock('../hooks/useAuth', () => ({
  useAuth: () => ({
    user: { id: 'u1', email: 'a@b.c', name: 'Alice', role: 'admin', subtitle: null, canVote: true },
    loading: false,
  }),
}))
vi.mock('../context/DemoContext', () => ({
  useDemo: () => ({ demoMode: false, demoLocked: false, settled: true, demoResetAt: 'epoch-1' }),
}))
vi.mock('../context/SidebarRefreshContext', () => ({ useSidebarRefresh: () => vi.fn() }))
vi.mock('../context/NotificationsContext', () => ({
  useNotifications: () => ({ unreadCount: 0, mentions: [], refresh: vi.fn(async () => {}) }),
}))
vi.mock('../hooks/usePolling', () => ({ usePolling: () => {} }))
vi.mock('../hooks/usePageTitle', () => ({ usePageTitle: () => {} }))

const DRAFT = {
  id: '42',
  externalId: null,
  billNumber: 'D1',
  title: 'Pre-filed draft',
  state: 'RI',
  status: '',
  statusDate: null,
  session: '',
  sessionId: null,
  sessionSlug: '2026',
  yearStart: 2026,
  yearEnd: 2026,
  description: null,
  billType: null,
  body: null,
  currentBody: null,
  abstract: null,
  stateLink: null,
  stateUrl: null,
  url: null,
  legiscanUrl: null,
  committee: null,
  referrals: [],
  tenantSummary: null,
  tags: [],
  relevanceScore: null,
  priority: null,
  textR2Key: null,
  sponsor: null,
  sponsorParty: null,
  sponsorUrl: null,
  coSponsors: [],
  lastAction: null,
  lastActionDate: null,
  history: [],
  voteSummary: [],
  subjects: [],
  relatedBillIds: [],
  companionBillIds: [],
  texts: [],
  calendar: [],
  supplements: [],
  amendments: [],
  customFieldValues: {},
  matchType: 'manual' as const,
  isDraft: true,
  draftText: null,
  createdAt: '2026-01-01 00:00:00',
  updatedAt: '2026-01-01 00:00:00',
  centralSyncedAt: null,
  aiProcessedAt: null,
  aiSkipReason: null,
  lastAiTextDocId: null,
  textStatus: 'not_checked' as const,
  myVote: null,
  myNote: null,
  priorityMeta: null,
  position: null,
  voteCounts: { support: 0, oppose: 0, neutral: 0, total: 0 },
  memberVotes: [],
  comments: [],
  commentsTotal: 0,
}

const CONFIG = {
  associationName: 'Test Assoc',
  positionVocabulary: ['support', 'oppose', 'neutral'],
  states: ['RI'],
  instanceDomains: {},
  orgNoun: 'association',
}

type Opts = {
  /** What GET /bills/draft-defaults reports: null on a multi-state tenant
   *  (the State editor is offered), a postal code on a single-state one. */
  tenantState?: string | null
  /** GET /bills/facets `state`. Omitted mocks a failure, which makes the
   *  State editor fall back to free text. */
  facetStates?: Record<string, number>
}

function mockApi(opts: Opts = {}) {
  routerMock.loaderData = { ...DRAFT }
  return vi.spyOn(api, 'apiFetch').mockImplementation(async (path: string, init?: RequestInit) => {
    if (path === '/bills/42' || path.startsWith('/bills/resolve/')) return { ...DRAFT } as never
    if (path.startsWith('/bills/draft-defaults')) {
      return { billNumber: 'D2', year: 2026, tenantState: 'tenantState' in opts ? opts.tenantState : null } as never
    }
    if (path === '/bills/facets') {
      if (opts.facetStates) return { state: opts.facetStates } as never
      throw new api.ApiError(500, 'facets unavailable')
    }
    if (path === '/bills/42/draft' && init?.method === 'PATCH') {
      return { ...DRAFT, ...JSON.parse(String(init.body)) } as never
    }
    if (path === '/config') return { ...CONFIG } as never
    if (path === '/config/custom-fields') return [] as never
    if (path === '/roles') return [] as never
    if (path === '/users') return [] as never
    return {} as never
  })
}

function patchCalls() {
  return vi.mocked(api.apiFetch).mock.calls.filter(([path, init]) => path === '/bills/42/draft' && init?.method === 'PATCH')
}

function renderPage() {
  return render(<MemoryRouter><BillDetail /></MemoryRouter>)
}

beforeEach(() => {
  vi.restoreAllMocks()
  navigateMock.mockClear()
  routerMock.params = { billId: '42' }
  routerMock.location = { state: null, pathname: '/bills/42', hash: '', search: '' }
})
afterEach(() => vi.restoreAllMocks())

describe('BillDetail draft bill-number editor: blank value', () => {
  async function openEditor() {
    const user = userEvent.setup()
    mockApi({ tenantState: 'RI' })
    renderPage()
    await user.click(await screen.findByRole('button', { name: 'Edit bill number' }))
    return { user, input: screen.getByRole('textbox', { name: /bill number/i }) as HTMLInputElement }
  }

  it('marks the bill number input as required', async () => {
    const { input } = await openEditor()
    expect(input).toHaveAttribute('aria-required', 'true')
  })

  it('shows no message before a blank save', async () => {
    const { input } = await openEditor()
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    expect(input).not.toHaveAttribute('aria-invalid')
    expect(input).not.toHaveAttribute('aria-describedby')
  })

  it('saving blank shows an inline "required" message and sends nothing', async () => {
    const { user, input } = await openEditor()
    await user.clear(input)
    await user.click(screen.getByRole('button', { name: 'Save' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('Bill number is required')
    expect(patchCalls()).toHaveLength(0)
  })

  it('saving whitespace only is treated as blank', async () => {
    const { user, input } = await openEditor()
    await user.clear(input)
    await user.type(input, '   ')
    await user.click(screen.getByRole('button', { name: 'Save' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('Bill number is required')
    expect(patchCalls()).toHaveLength(0)
  })

  it('saving blank with Enter shows the message too', async () => {
    const { user, input } = await openEditor()
    await user.clear(input)
    await user.type(input, '{Enter}')

    expect(await screen.findByRole('alert')).toHaveTextContent('Bill number is required')
    expect(patchCalls()).toHaveLength(0)
  })

  it('announces the message and ties it to the input', async () => {
    const { user, input } = await openEditor()
    await user.clear(input)
    await user.click(screen.getByRole('button', { name: 'Save' }))

    const alert = await screen.findByRole('alert')
    expect(input).toHaveAttribute('aria-invalid', 'true')
    expect(input).toHaveAttribute('aria-describedby', alert.id)
    expect(input).toHaveAccessibleDescription('Bill number is required')
  })

  it('keeps the editor open after a blank save', async () => {
    const { user, input } = await openEditor()
    await user.clear(input)
    await user.click(screen.getByRole('button', { name: 'Save' }))

    await screen.findByRole('alert')
    expect(screen.getByRole('textbox', { name: /bill number/i })).toBe(input)
    expect(screen.queryByRole('button', { name: 'Edit bill number' })).not.toBeInTheDocument()
  })

  it('clears the message once a value is entered, and then saves it', async () => {
    const { user, input } = await openEditor()
    await user.clear(input)
    await user.click(screen.getByRole('button', { name: 'Save' }))
    await screen.findByRole('alert')

    await user.type(input, 'D9')
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    expect(input).not.toHaveAttribute('aria-invalid')

    await user.click(screen.getByRole('button', { name: 'Save' }))
    await waitFor(() => expect(api.apiFetch).toHaveBeenCalledWith(
      '/bills/42/draft',
      expect.objectContaining({ method: 'PATCH', body: JSON.stringify({ billNumber: 'D9' }) }),
    ))
    expect(await screen.findByRole('button', { name: 'Edit bill number' })).toHaveTextContent('Bill number: D9')
  })

  it('keeps the message while only whitespace is typed', async () => {
    const { user, input } = await openEditor()
    await user.clear(input)
    await user.click(screen.getByRole('button', { name: 'Save' }))
    await screen.findByRole('alert')

    await user.type(input, '  ')
    expect(screen.getByRole('alert')).toHaveTextContent('Bill number is required')
  })

  it('Cancel closes the editor and clears the message, which stays gone on reopening', async () => {
    const { user, input } = await openEditor()
    await user.clear(input)
    await user.click(screen.getByRole('button', { name: 'Save' }))
    await screen.findByRole('alert')

    await user.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Edit bill number' })).toHaveTextContent('Bill number: D1')

    await user.click(screen.getByRole('button', { name: 'Edit bill number' }))
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    expect(screen.getByRole('textbox', { name: /bill number/i })).not.toHaveAttribute('aria-invalid')
  })

  it('Escape closes the editor and clears the message', async () => {
    const { user, input } = await openEditor()
    await user.clear(input)
    await user.click(screen.getByRole('button', { name: 'Save' }))
    await screen.findByRole('alert')

    await user.type(input, '{Escape}')
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Edit bill number' }))
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })
})

describe('BillDetail draft State editor (free text): blank value', () => {
  async function openEditor() {
    const user = userEvent.setup()
    mockApi({ tenantState: null })
    renderPage()
    await user.click(await screen.findByRole('button', { name: 'Edit state' }))
    return { user, input: screen.getByRole('textbox', { name: /state/i }) as HTMLInputElement }
  }

  it('marks the state input as required', async () => {
    const { input } = await openEditor()
    expect(input).toHaveAttribute('aria-required', 'true')
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('saving blank shows an inline "required" message and sends nothing', async () => {
    const { user, input } = await openEditor()
    await user.clear(input)
    await user.click(screen.getByRole('button', { name: 'Save' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('State is required')
    expect(patchCalls()).toHaveLength(0)
  })

  it('saving whitespace only is treated as blank', async () => {
    const { user, input } = await openEditor()
    await user.clear(input)
    await user.type(input, ' ')
    await user.click(screen.getByRole('button', { name: 'Save' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('State is required')
    expect(patchCalls()).toHaveLength(0)
  })

  it('announces the message and ties it to the input', async () => {
    const { user, input } = await openEditor()
    await user.clear(input)
    await user.click(screen.getByRole('button', { name: 'Save' }))

    const alert = await screen.findByRole('alert')
    expect(input).toHaveAttribute('aria-invalid', 'true')
    expect(input).toHaveAttribute('aria-describedby', alert.id)
    expect(input).toHaveAccessibleDescription('State is required')
  })

  it('keeps the editor open after a blank save', async () => {
    const { user, input } = await openEditor()
    await user.clear(input)
    await user.click(screen.getByRole('button', { name: 'Save' }))

    await screen.findByRole('alert')
    expect(screen.getByRole('textbox', { name: /state/i })).toBe(input)
    expect(screen.queryByRole('button', { name: 'Edit state' })).not.toBeInTheDocument()
  })

  it('clears the message once a value is entered, and then saves it', async () => {
    const { user, input } = await openEditor()
    await user.clear(input)
    await user.click(screen.getByRole('button', { name: 'Save' }))
    await screen.findByRole('alert')

    await user.type(input, 'TX')
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Save' }))

    await waitFor(() => expect(api.apiFetch).toHaveBeenCalledWith(
      '/bills/42/draft',
      expect.objectContaining({ method: 'PATCH', body: JSON.stringify({ state: 'TX' }) }),
    ))
    expect(await screen.findByRole('button', { name: 'Edit state' })).toHaveTextContent('State: TX')
  })

  it('Cancel closes the editor and clears the message, which stays gone on reopening', async () => {
    const { user, input } = await openEditor()
    await user.clear(input)
    await user.click(screen.getByRole('button', { name: 'Save' }))
    await screen.findByRole('alert')

    await user.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Edit state' }))
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('a blank state does not leave the bill-number editor showing a message', async () => {
    const { user, input } = await openEditor()
    await user.clear(input)
    await user.click(screen.getByRole('button', { name: 'Save' }))
    await screen.findByRole('alert')
    await user.click(screen.getByRole('button', { name: 'Cancel' }))

    await user.click(screen.getByRole('button', { name: 'Edit bill number' }))
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })
})

describe('BillDetail draft State editor (Picker): blank value', () => {
  async function openEditor() {
    const user = userEvent.setup()
    mockApi({ tenantState: null, facetStates: { RI: 3, TX: 2 } })
    renderPage()
    await user.click(await screen.findByRole('button', { name: 'Edit state' }))
    const trigger = await screen.findByRole('button', { name: 'State (required)' })
    return { user, trigger }
  }

  async function chooseNone(user: ReturnType<typeof userEvent.setup>, trigger: HTMLElement) {
    await user.click(trigger)
    fireEvent.click(screen.getByRole('radio', { name: 'Select a state…' }))
  }

  it('names the State picker as required', async () => {
    const { trigger } = await openEditor()
    expect(trigger).toHaveTextContent('RI')
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('saving with no state chosen shows an inline "required" message and sends nothing', async () => {
    const { user, trigger } = await openEditor()
    await chooseNone(user, trigger)
    await user.click(screen.getByRole('button', { name: 'Save' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('State is required')
    expect(patchCalls()).toHaveLength(0)
  })

  it('ties the message to the picker trigger and keeps the editor open', async () => {
    const { user, trigger } = await openEditor()
    await chooseNone(user, trigger)
    await user.click(screen.getByRole('button', { name: 'Save' }))

    const alert = await screen.findByRole('alert')
    const current = screen.getByRole('button', { name: 'State (required)' })
    expect(current).toHaveAttribute('aria-describedby', alert.id)
    expect(current).toHaveAccessibleDescription('State is required')
    expect(screen.queryByRole('button', { name: 'Edit state' })).not.toBeInTheDocument()
  })

  it('clears the message once a state is chosen, and then saves it', async () => {
    const { user, trigger } = await openEditor()
    await chooseNone(user, trigger)
    await user.click(screen.getByRole('button', { name: 'Save' }))
    await screen.findByRole('alert')

    await user.click(screen.getByRole('button', { name: 'State (required)' }))
    fireEvent.click(screen.getByRole('radio', { name: 'TX' }))
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Save' }))
    await waitFor(() => expect(api.apiFetch).toHaveBeenCalledWith(
      '/bills/42/draft',
      expect.objectContaining({ method: 'PATCH', body: JSON.stringify({ state: 'TX' }) }),
    ))
    expect(await screen.findByRole('button', { name: 'Edit state' })).toHaveTextContent('State: TX')
  })

  it('Cancel clears the message', async () => {
    const { user, trigger } = await openEditor()
    await chooseNone(user, trigger)
    await user.click(screen.getByRole('button', { name: 'Save' }))
    await screen.findByRole('alert')

    await user.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Edit state' }))
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })
})
