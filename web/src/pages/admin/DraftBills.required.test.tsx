import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { DraftBills } from './DraftBills'
import * as api from '../../lib/api'

// The required-field pattern on the create-draft form: a "* Required" legend,
// a red asterisk plus aria-required on each required field, and a visible
// "Missing a required field (*)" reason next to the disabled Create draft
// button while a required value is missing. On this form the only required
// field is State, and only on a tenant that covers more than one state.

const demoState = vi.hoisted(() => ({ demoLocked: false }))
vi.mock('../../context/DemoContext', () => ({
  useDemo: () => ({ demoMode: false, demoLocked: demoState.demoLocked }),
}))

const REASON = 'Missing a required field (*)'

type Opts = {
  tenantState?: string | null
  states?: Record<string, number> | 'fail'
  // When set, POST /bills/draft hangs until the returned release() is called.
  holdCreate?: boolean
}

function mockApi(opts: Opts = {}) {
  let release: () => void = () => {}
  const posted: Record<string, unknown>[] = []
  vi.spyOn(api, 'apiFetch').mockImplementation(async (path: string, init?: RequestInit) => {
    if (path === '/bills/drafts') return { drafts: [] } as never
    if (path === '/bills/facets') {
      if (opts.states === 'fail') throw new api.ApiError(500, 'facets unavailable')
      return { state: opts.states ?? { AA: 3, BB: 1 } } as never
    }
    if (path.startsWith('/bills/draft-defaults')) {
      return { billNumber: 'D1', year: 2026, tenantState: 'tenantState' in opts ? opts.tenantState : null } as never
    }
    if (path === '/bills/draft') {
      posted.push(JSON.parse(String(init?.body)))
      if (opts.holdCreate) await new Promise<void>(resolve => { release = resolve })
      return { id: 'new-draft' } as never
    }
    return {} as never
  })
  return { posted, release: () => release() }
}

function renderPage() {
  return render(<MemoryRouter><DraftBills /></MemoryRouter>)
}

async function openForm() {
  const user = userEvent.setup()
  await user.click(await screen.findByRole('button', { name: /add draft bill/i }))
  await screen.findByDisplayValue('D1')
  return user
}

function submitButton() {
  return screen.getByRole('button', { name: /create draft/i })
}

function stateLabel() {
  return screen.getAllByText(/^State/).find(el => el.tagName === 'LABEL') as HTMLLabelElement
}

async function pickState(user: ReturnType<typeof userEvent.setup>, abbr: string) {
  await user.click(screen.getByRole('button', { name: /^state/i }))
  fireEvent.click(screen.getByRole('radio', { name: abbr }))
}

describe('DraftBills required fields: multi-state tenant (State is required)', () => {
  beforeEach(() => vi.restoreAllMocks())
  afterEach(() => { demoState.demoLocked = false })

  it('shows a "* Required" legend on the form', async () => {
    mockApi()
    renderPage()
    await openForm()
    const legend = screen.getByText('Required')
    expect(legend.parentElement).toHaveTextContent('* Required')
  })

  it('does not show the legend before the form is opened', async () => {
    mockApi()
    renderPage()
    await screen.findByRole('button', { name: /add draft bill/i })
    expect(screen.queryByText('Required')).not.toBeInTheDocument()
  })

  it('marks the State label with a red asterisk', async () => {
    mockApi()
    renderPage()
    await openForm()
    expect(stateLabel()).toHaveTextContent('State *')
  })

  it('announces the State picker as required', async () => {
    mockApi()
    renderPage()
    await openForm()
    // The picker's trigger is a button, which cannot carry aria-required, so
    // the requirement is in its accessible name.
    expect(screen.getByRole('button', { name: 'State (required)' })).toBeInTheDocument()
  })

  it('puts aria-required on the free-text State input when there are no states to offer', async () => {
    mockApi({ states: 'fail' })
    renderPage()
    await openForm()
    const input = await screen.findByLabelText(/^state/i)
    expect(input.tagName).toBe('INPUT')
    expect(input).toHaveAttribute('aria-required', 'true')
  })

  it('does not mark the optional fields as required', async () => {
    mockApi({ states: 'fail' })
    renderPage()
    await openForm()
    for (const label of [/bill number/i, /^title/i, /sponsor/i]) {
      expect(screen.getByLabelText(label)).not.toHaveAttribute('aria-required')
    }
    expect(screen.getByLabelText(/^title/i).closest('div')?.querySelector('label')?.textContent).not.toContain('*')
  })

  it('shows the reason next to the disabled button while State is missing', async () => {
    mockApi()
    renderPage()
    await openForm()
    expect(submitButton()).toBeDisabled()
    expect(screen.getByText('Missing a required field')).toBeInTheDocument()
    expect(screen.getByText('Missing a required field').closest('[id]')).toHaveTextContent(REASON)
  })

  it('links the disabled button to the reason with aria-describedby', async () => {
    mockApi()
    renderPage()
    await openForm()
    // The "(*)" points sighted users at the marker; the asterisk is hidden
    // from assistive tech, so a screen reader hears the sentence alone.
    expect(submitButton()).toHaveAccessibleDescription('Missing a required field')
    const id = submitButton().getAttribute('aria-describedby')
    expect(id).toBeTruthy()
    expect(document.getElementById(id!)).toHaveTextContent(REASON)
  })

  it('renders the reason asterisk in the same red as the field marker', async () => {
    mockApi()
    renderPage()
    await openForm()
    const marker = stateLabel().querySelector('span') as HTMLElement
    const reason = document.getElementById(submitButton().getAttribute('aria-describedby')!) as HTMLElement
    const reasonStar = Array.from(reason.querySelectorAll('span')).find(s => s.textContent === '*') as HTMLElement
    const legendStar = Array.from((screen.getByText('Required').parentElement as HTMLElement).querySelectorAll('span'))
      .find(s => s.textContent === '*') as HTMLElement
    expect(marker.textContent).toBe('*')
    expect(marker.style.color).toBeTruthy()
    expect(reasonStar.style.color).toBe(marker.style.color)
    expect(legendStar.style.color).toBe(marker.style.color)
  })

  it('does not name the missing field in the reason', async () => {
    mockApi()
    renderPage()
    await openForm()
    const reason = document.getElementById(submitButton().getAttribute('aria-describedby')!) as HTMLElement
    expect(reason.textContent).toBe(REASON)
    expect(reason.textContent).not.toMatch(/state/i)
  })

  it('hides the reason and enables the button once State is chosen', async () => {
    mockApi()
    renderPage()
    const user = await openForm()
    await pickState(user, 'AA')
    expect(submitButton()).toBeEnabled()
    expect(screen.queryByText('Missing a required field')).not.toBeInTheDocument()
    expect(submitButton()).not.toHaveAttribute('aria-describedby')
  })

  it('brings the reason back when State is cleared again', async () => {
    mockApi()
    renderPage()
    const user = await openForm()
    await pickState(user, 'AA')
    expect(screen.queryByText('Missing a required field')).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /^state/i }))
    fireEvent.click(screen.getByRole('radio', { name: 'Select a state…' }))
    expect(submitButton()).toBeDisabled()
    expect(screen.getByText('Missing a required field')).toBeInTheDocument()
    expect(submitButton()).toHaveAccessibleDescription('Missing a required field')
  })

  it('tracks the free-text State input: shown while empty, gone when typed, back when erased', async () => {
    mockApi({ states: 'fail' })
    renderPage()
    const user = await openForm()
    const input = await screen.findByLabelText(/^state/i)
    expect(screen.getByText('Missing a required field')).toBeInTheDocument()

    await user.type(input, 'aa')
    expect(submitButton()).toBeEnabled()
    expect(screen.queryByText('Missing a required field')).not.toBeInTheDocument()

    await user.clear(input)
    expect(submitButton()).toBeDisabled()
    expect(screen.getByText('Missing a required field')).toBeInTheDocument()
  })

  it('treats a whitespace-only State as missing', async () => {
    mockApi({ states: 'fail' })
    renderPage()
    const user = await openForm()
    await user.type(await screen.findByLabelText(/^state/i), ' ')
    expect(submitButton()).toBeDisabled()
    expect(screen.getByText('Missing a required field')).toBeInTheDocument()
  })

  it('keeps the legend after State is filled: it explains the marker, not the error', async () => {
    mockApi()
    renderPage()
    const user = await openForm()
    await pickState(user, 'AA')
    expect(screen.getByText('Required')).toBeInTheDocument()
  })

  it('does not show the reason when the button is disabled only by demo lock', async () => {
    mockApi()
    const { rerender } = renderPage()
    const user = await openForm()
    await pickState(user, 'AA')

    demoState.demoLocked = true
    rerender(<MemoryRouter><DraftBills /></MemoryRouter>)
    expect(submitButton()).toBeDisabled()
    expect(screen.queryByText('Missing a required field')).not.toBeInTheDocument()
    expect(submitButton()).not.toHaveAttribute('aria-describedby')
  })

  it('does not show the reason under demo lock even while State is missing, since filling it would not help', async () => {
    mockApi()
    const { rerender } = renderPage()
    await openForm()
    expect(screen.getByText('Missing a required field')).toBeInTheDocument()

    demoState.demoLocked = true
    rerender(<MemoryRouter><DraftBills /></MemoryRouter>)
    expect(submitButton()).toBeDisabled()
    expect(screen.queryByText('Missing a required field')).not.toBeInTheDocument()
  })

  it('does not show the reason while the create request is in flight', async () => {
    const { posted, release } = mockApi({ holdCreate: true })
    renderPage()
    const user = await openForm()
    await pickState(user, 'AA')
    await user.click(submitButton())

    await waitFor(() => expect(posted).toHaveLength(1))
    const busy = screen.getByRole('button', { name: /creating/i })
    expect(busy).toBeDisabled()
    expect(screen.queryByText('Missing a required field')).not.toBeInTheDocument()
    expect(busy).not.toHaveAttribute('aria-describedby')
    await act(async () => { release() })
  })

  it('shows the legend and reason again when the form is reopened after Cancel', async () => {
    mockApi()
    renderPage()
    const user = await openForm()
    await pickState(user, 'AA')
    await user.click(screen.getByRole('button', { name: /^cancel$/i }))
    expect(screen.queryByText('Required')).not.toBeInTheDocument()

    await openForm()
    expect(screen.getByText('Required')).toBeInTheDocument()
    expect(screen.getByText('Missing a required field')).toBeInTheDocument()
  })
})

describe('DraftBills required fields: single-state tenant (nothing is required)', () => {
  beforeEach(() => vi.restoreAllMocks())

  it('shows no legend, no reason, and no aria-required', async () => {
    mockApi({ tenantState: 'AA', states: { AA: 5 } })
    renderPage()
    await openForm()
    await waitFor(() => expect(screen.queryByText(/^state/i)).not.toBeInTheDocument())
    expect(screen.queryByText('Required')).not.toBeInTheDocument()
    expect(screen.queryByText('Missing a required field')).not.toBeInTheDocument()
    expect(document.querySelector('[aria-required]')).toBeNull()
    expect(submitButton()).toBeEnabled()
    expect(submitButton()).not.toHaveAttribute('aria-describedby')
  })

  it('shows no reason when the button is disabled by demo lock', async () => {
    mockApi({ tenantState: 'AA', states: { AA: 5 } })
    const { rerender } = renderPage()
    await openForm()
    await waitFor(() => expect(submitButton()).toBeEnabled())
    demoState.demoLocked = true
    rerender(<MemoryRouter><DraftBills /></MemoryRouter>)
    expect(submitButton()).toBeDisabled()
    expect(screen.queryByText('Missing a required field')).not.toBeInTheDocument()
    demoState.demoLocked = false
  })
})
