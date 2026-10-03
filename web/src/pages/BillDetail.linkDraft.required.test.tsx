import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, waitFor, act } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { BillDetail } from './BillDetail'
import * as api from '../lib/api'

// The required-field pattern on the "Link draft" control: a filed bill must be
// chosen before the draft can be linked. The picker's search input carries
// aria-required, and the disabled link button explains itself with
// "Missing a required field (*)".

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
const demoState = vi.hoisted(() => ({ demoLocked: false }))
vi.mock('../context/DemoContext', () => ({
  useDemo: () => ({ demoMode: false, demoLocked: demoState.demoLocked, settled: true, demoResetAt: 'epoch-1' }),
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

const FILED = [
  { id: 'f1', billNumber: 'H 100', title: 'Filed elections bill', state: 'RI', isDraft: false },
  { id: 'f2', billNumber: 'S 200', title: 'Filed records bill', state: 'RI', isDraft: false },
]

const REASON = 'Missing a required field (*)'

function mockApi({ holdLink = false }: { holdLink?: boolean } = {}) {
  let release: () => void = () => {}
  const links: unknown[] = []
  routerMock.loaderData = { ...DRAFT }
  vi.spyOn(api, 'apiFetch').mockImplementation(async (path: string, init?: RequestInit) => {
    if (path === '/bills/42' || path.startsWith('/bills/resolve/')) return { ...DRAFT } as never
    if (path.startsWith('/bills/draft-defaults')) return { billNumber: 'D2', year: 2026, tenantState: 'RI' } as never
    if (path === '/calendar/bill-options') return FILED as never
    if (path === '/bills/42/link' && init?.method === 'POST') {
      links.push(JSON.parse(String(init.body)))
      if (holdLink) await new Promise<void>(resolve => { release = resolve })
      return { ok: true, filedBillId: 'f1' } as never
    }
    if (path === '/config') return { ...CONFIG } as never
    if (path === '/config/custom-fields') return [] as never
    if (path === '/roles') return [] as never
    if (path === '/users') return [] as never
    return {} as never
  })
  return { links, release: () => release() }
}

async function setup() {
  const user = userEvent.setup()
  render(<MemoryRouter><BillDetail /></MemoryRouter>)
  const group = await screen.findByRole('group', { name: /link to filed bill/i })
  return { user, group }
}

const linkButton = () => screen.getByRole('button', { name: /^(link & merge into filed bill|linking…)$/i })
const search = () => screen.getByRole('textbox', { name: /filed bill/i })
const reason = () => screen.queryByText('Missing a required field')

async function pick(user: ReturnType<typeof userEvent.setup>, query: string, number: string) {
  await user.type(search(), query)
  await user.click(await screen.findByRole('button', { name: new RegExp(number) }))
}

let confirmSpy: ReturnType<typeof vi.spyOn>
beforeEach(() => {
  vi.restoreAllMocks()
  navigateMock.mockClear()
  demoState.demoLocked = false
  routerMock.params = { billId: '42' }
  routerMock.location = { state: null, pathname: '/bills/42', hash: '', search: '' }
  confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true)
})
afterEach(() => { vi.restoreAllMocks(); demoState.demoLocked = false })

describe('BillDetail link draft: a filed bill is required', () => {
  it('shows a "* Required" legend in the link control', async () => {
    mockApi()
    await setup()
    expect(screen.getByText('Required').parentElement).toHaveTextContent('* Required')
  })

  it('labels the filed-bill search with a red asterisk and aria-required', async () => {
    mockApi()
    await setup()
    expect(search()).toHaveAttribute('aria-required', 'true')
    expect(search()).toHaveAccessibleName('Filed bill')
    const label = document.querySelector(`label[for="${search().id}"]`) as HTMLLabelElement
    expect(label).toHaveTextContent('Filed bill *')
  })

  it('shows the reason beside the disabled link button while no bill is chosen', async () => {
    mockApi()
    await setup()
    expect(linkButton()).toBeDisabled()
    expect(reason()?.closest('[id]')).toHaveTextContent(REASON)
    expect(linkButton()).toHaveAccessibleDescription('Missing a required field')
  })

  it('keeps the reason while a search is typed but nothing is chosen', async () => {
    mockApi()
    const { user } = await setup()
    await user.type(search(), 'H 1')
    expect(linkButton()).toBeDisabled()
    expect(reason()).toBeInTheDocument()
  })

  it('hides the reason once a filed bill is chosen, and brings it back when removed', async () => {
    mockApi()
    const { user } = await setup()
    await pick(user, 'H 1', 'H 100')
    expect(linkButton()).toBeEnabled()
    expect(reason()).not.toBeInTheDocument()
    expect(linkButton()).not.toHaveAttribute('aria-describedby')

    await user.click(screen.getByRole('button', { name: 'Remove H 100' }))
    expect(linkButton()).toBeDisabled()
    expect(reason()).toBeInTheDocument()
  })

  it('links to the chosen bill', async () => {
    const { links } = mockApi()
    const { user } = await setup()
    await pick(user, 'S 2', 'S 200')
    await user.click(linkButton())
    await waitFor(() => expect(links).toEqual([{ filedBillId: 'f2' }]))
    expect(confirmSpy).toHaveBeenCalled()
  })

  it('does not show the reason when the button is disabled only by demo lock', async () => {
    demoState.demoLocked = true
    mockApi()
    const { user } = await setup()
    await pick(user, 'H 1', 'H 100')
    expect(linkButton()).toBeDisabled()
    expect(reason()).not.toBeInTheDocument()
    expect(linkButton()).not.toHaveAttribute('aria-describedby')
  })

  it('does not show the reason under demo lock even with no bill chosen', async () => {
    demoState.demoLocked = true
    mockApi()
    await setup()
    expect(linkButton()).toBeDisabled()
    expect(reason()).not.toBeInTheDocument()
  })

  it('does not show the reason while the link request is in flight', async () => {
    const { links, release } = mockApi({ holdLink: true })
    const { user } = await setup()
    await pick(user, 'H 1', 'H 100')
    await user.click(linkButton())
    await waitFor(() => expect(links).toHaveLength(1))
    const busy = screen.getByRole('button', { name: /linking/i })
    expect(busy).toBeDisabled()
    expect(reason()).not.toBeInTheDocument()
    expect(busy).not.toHaveAttribute('aria-describedby')
    await act(async () => { release() })
  })
})
