import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, within, waitFor, act } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { Members } from './Members'
import * as api from '../../lib/api'

// The required-field pattern on the "Add role" form: the role name is
// required, gets a real accessible name and aria-required, and the disabled
// Add button explains itself with "Missing a required field (*)".

const OWNER = {
  id: 'owner-1',
  email: 'owner@example.com',
  name: 'Sole Owner',
  role: 'owner' as const,
  subtitle: null,
  createdAt: '2024-01-01T00:00:00Z',
  lastActive: '2024-01-01T00:00:00Z',
  deactivatedAt: null,
  hasLoggedIn: true,
  invitedBy: null,
  roles: [],
  canVote: true,
  voteCount: 0,
}

vi.mock('../../hooks/useAuth', () => ({
  useAuth: () => ({
    user: { id: 'owner-1', email: 'owner@example.com', name: 'Sole Owner', role: 'owner' },
    loading: false,
  }),
}))

const demoState = vi.hoisted(() => ({ demoLocked: false }))
vi.mock('../../context/DemoContext', () => ({
  useDemo: () => ({ demoMode: false, demoLocked: demoState.demoLocked }),
}))

const REASON = 'Missing a required field (*)'

function mockApi({ holdCreate = false }: { holdCreate?: boolean } = {}) {
  let release: () => void = () => {}
  const posted: unknown[] = []
  vi.spyOn(api, 'apiFetch').mockImplementation(async (path: string, init?: RequestInit) => {
    if (path === '/admin/members') return [OWNER] as never
    if (path === '/admin/roles' && init?.method === 'POST') {
      const body = JSON.parse(String(init.body))
      posted.push(body)
      if (holdCreate) await new Promise<void>(resolve => { release = resolve })
      return { id: 'r-new', name: body.name } as never
    }
    if (path === '/admin/roles') return [] as never
    if (path === '/admin/config') return {} as never
    return {} as never
  })
  return { posted, release: () => release() }
}

async function setup() {
  const user = userEvent.setup()
  render(<MemoryRouter><Members /></MemoryRouter>)
  const form = await screen.findByRole('group', { name: 'Add role' })
  return { user, form }
}

function nameInput(form: HTMLElement) {
  return within(form).getByRole('textbox', { name: /role name/i })
}
function addButton(form: HTMLElement) {
  return within(form).getByRole('button', { name: /^(add|adding…)$/i })
}
function reason(form: HTMLElement) {
  return within(form).queryByText('Missing a required field')
}

afterEach(() => { vi.restoreAllMocks(); demoState.demoLocked = false })

describe('Members "Add role" required field', () => {
  it('shows a "* Required" legend on the form', async () => {
    mockApi()
    const { form } = await setup()
    expect(within(form).getByText('Required').parentElement).toHaveTextContent('* Required')
  })

  it('gives the role name input an accessible name and aria-required', async () => {
    mockApi()
    const { form } = await setup()
    const input = nameInput(form)
    expect(input).toHaveAttribute('aria-required', 'true')
    expect(within(form).getAllByText(/role name/i).find(el => el.tagName === 'LABEL')).toHaveTextContent('*')
  })

  it('shows the reason beside the disabled Add button while the name is empty', async () => {
    mockApi()
    const { form } = await setup()
    expect(addButton(form)).toBeDisabled()
    expect(reason(form)?.closest('[id]')).toHaveTextContent(REASON)
    expect(addButton(form)).toHaveAccessibleDescription('Missing a required field')
  })

  it('hides the reason once a name is typed, and brings it back when cleared', async () => {
    mockApi()
    const { user, form } = await setup()
    await user.type(nameInput(form), 'Finance')
    expect(addButton(form)).toBeEnabled()
    expect(reason(form)).not.toBeInTheDocument()
    expect(addButton(form)).not.toHaveAttribute('aria-describedby')

    await user.clear(nameInput(form))
    expect(addButton(form)).toBeDisabled()
    expect(reason(form)).toBeInTheDocument()
  })

  it('treats a whitespace-only name as missing', async () => {
    mockApi()
    const { user, form } = await setup()
    await user.type(nameInput(form), '   ')
    expect(addButton(form)).toBeDisabled()
    expect(reason(form)).toBeInTheDocument()
  })

  it('treats a name made only of stripped "@" characters as missing', async () => {
    mockApi()
    const { user, form } = await setup()
    await user.type(nameInput(form), '@@')
    expect(addButton(form)).toBeDisabled()
    expect(reason(form)).toBeInTheDocument()
  })

  it('does not send a request for a blank name on Enter', async () => {
    const { posted } = mockApi()
    const { user, form } = await setup()
    await user.type(nameInput(form), '  {Enter}')
    expect(posted).toHaveLength(0)
  })

  it('does not show the reason when the button is disabled only by demo lock', async () => {
    demoState.demoLocked = true
    mockApi()
    const { user, form } = await setup()
    await user.type(nameInput(form), 'Finance')
    expect(addButton(form)).toBeDisabled()
    expect(reason(form)).not.toBeInTheDocument()
    expect(addButton(form)).not.toHaveAttribute('aria-describedby')
  })

  it('does not show the reason under demo lock even while the name is empty', async () => {
    demoState.demoLocked = true
    mockApi()
    const { form } = await setup()
    expect(addButton(form)).toBeDisabled()
    expect(reason(form)).not.toBeInTheDocument()
  })

  it('does not show the reason while the create request is in flight', async () => {
    const { posted, release } = mockApi({ holdCreate: true })
    const { user, form } = await setup()
    await user.type(nameInput(form), 'Finance')
    await user.click(addButton(form))
    await waitFor(() => expect(posted).toHaveLength(1))
    const busy = within(form).getByRole('button', { name: /adding/i })
    expect(busy).toBeDisabled()
    expect(reason(form)).not.toBeInTheDocument()
    expect(busy).not.toHaveAttribute('aria-describedby')
    await act(async () => { release() })
  })

  it('shows the reason again after a role is added and the input resets', async () => {
    const { posted } = mockApi()
    const { user, form } = await setup()
    await user.type(nameInput(form), 'Finance')
    await user.click(addButton(form))
    await waitFor(() => expect(posted).toHaveLength(1))
    await waitFor(() => expect(nameInput(form)).toHaveValue(''))
    expect(reason(form)).toBeInTheDocument()
  })
})
