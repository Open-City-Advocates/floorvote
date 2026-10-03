import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { Members } from './Members'
import * as api from '../../lib/api'

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

const ROLE = { id: 'r1', name: 'Finance Committee' }

vi.mock('../../hooks/useAuth', () => ({
  useAuth: () => ({
    user: { id: 'owner-1', email: 'owner@example.com', name: 'Sole Owner', role: 'owner' },
    loading: false,
  }),
}))

// DemoContext's default value (no provider wrapping) is demoLocked: false; a
// mutable flag lets individual tests opt into the demo-locked state without a
// module-level mock rewrite per test.
const demoState = vi.hoisted(() => ({ demoLocked: false }))
vi.mock('../../context/DemoContext', () => ({
  useDemo: () => ({ demoMode: false, demoLocked: demoState.demoLocked }),
}))

function mockApi() {
  vi.spyOn(api, 'apiFetch').mockImplementation(async (path: string, init?: RequestInit) => {
    if (path === '/admin/members') return [OWNER] as never
    if (path === '/admin/roles') return [ROLE] as never
    if (path === `/admin/roles/${ROLE.id}` && init?.method === 'PATCH') {
      return { ...ROLE, ...JSON.parse(String(init.body)) } as never
    }
    if (path === '/admin/config') return {} as never
    return {} as never
  })
}

afterEach(() => { vi.restoreAllMocks(); demoState.demoLocked = false })

// The role-rename "click to rename" affordance was a plain span with an
// onClick handler — unreachable by keyboard. It must be a real button.
describe('Members role-rename inline edit keyboard access', () => {
  it('renders the role-rename affordance as a button and enters rename mode from the keyboard', async () => {
    const user = userEvent.setup()
    mockApi()

    render(
      <MemoryRouter>
        <Members />
      </MemoryRouter>,
    )

    const rename = await screen.findByRole('button', { name: /rename role finance committee/i })
    rename.focus()
    await user.keyboard('{Enter}')

    expect(await screen.findByDisplayValue('Finance Committee')).toBeInTheDocument()
  })

  it('disables the role-rename button in demo-locked mode', async () => {
    demoState.demoLocked = true
    mockApi()

    render(
      <MemoryRouter>
        <Members />
      </MemoryRouter>,
    )

    const rename = await screen.findByRole('button', { name: /rename role finance committee/i })
    expect(rename).toBeDisabled()
  })
})

// Renaming a role refuses a blank name. It used to close the editor and
// silently put the old name back; now saving blank says why (an inline
// "Role name is required" message, announced to screen readers and tied to the
// input), keeps the editor open, and sends nothing.
describe('Members role rename: blank name', () => {
  function patchCalls() {
    return vi.mocked(api.apiFetch).mock.calls.filter(([, init]) => init?.method === 'PATCH')
  }

  async function beginRename() {
    const user = userEvent.setup()
    mockApi()
    render(
      <MemoryRouter>
        <Members />
      </MemoryRouter>,
    )
    await user.click(await screen.findByRole('button', { name: /rename role finance committee/i }))
    return { user, input: screen.getByRole('textbox', { name: 'Role name' }) as HTMLInputElement }
  }

  it('names the rename input and marks it as required, with no message on open', async () => {
    const { input } = await beginRename()
    expect(input).toHaveValue('Finance Committee')
    expect(input).toHaveAttribute('aria-required', 'true')
    expect(input).not.toHaveAttribute('aria-invalid')
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('saving blank shows an inline "required" message and sends nothing', async () => {
    const { user, input } = await beginRename()
    await user.clear(input)
    await user.type(input, '{Enter}')

    expect(await screen.findByRole('alert')).toHaveTextContent('Role name is required')
    expect(patchCalls()).toHaveLength(0)
  })

  it('saving whitespace only is treated as blank', async () => {
    const { user, input } = await beginRename()
    await user.clear(input)
    await user.type(input, '   {Enter}')

    expect(await screen.findByRole('alert')).toHaveTextContent('Role name is required')
    expect(patchCalls()).toHaveLength(0)
  })

  it('announces the message and ties it to the input', async () => {
    const { user, input } = await beginRename()
    await user.clear(input)
    await user.type(input, '{Enter}')

    const alert = await screen.findByRole('alert')
    expect(input).toHaveAttribute('aria-invalid', 'true')
    expect(input).toHaveAttribute('aria-describedby', alert.id)
    expect(input).toHaveAccessibleDescription('Role name is required')
  })

  it('keeps the editor open instead of silently reverting', async () => {
    const { user, input } = await beginRename()
    await user.clear(input)
    await user.type(input, '{Enter}')

    await screen.findByRole('alert')
    expect(screen.getByRole('textbox', { name: 'Role name' })).toBe(input)
    expect(input).toHaveValue('')
    expect(screen.queryByRole('button', { name: /rename role finance committee/i })).not.toBeInTheDocument()
  })

  it('clears the message once a name is typed, and then renames', async () => {
    const { user, input } = await beginRename()
    await user.clear(input)
    await user.type(input, '{Enter}')
    await screen.findByRole('alert')

    await user.type(input, 'Budget Committee')
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    expect(input).not.toHaveAttribute('aria-invalid')

    await user.type(input, '{Enter}')
    await waitFor(() => expect(api.apiFetch).toHaveBeenCalledWith(
      `/admin/roles/${ROLE.id}`,
      expect.objectContaining({ method: 'PATCH', body: JSON.stringify({ name: 'Budget Committee' }) }),
    ))
    expect(await screen.findByRole('button', { name: /rename role budget committee/i })).toBeInTheDocument()
  })

  it('keeps the message while only whitespace is typed', async () => {
    const { user, input } = await beginRename()
    await user.clear(input)
    await user.type(input, '{Enter}')
    await screen.findByRole('alert')

    await user.type(input, '  ')
    expect(screen.getByRole('alert')).toHaveTextContent('Role name is required')
  })

  it('Escape cancels: the old name returns and the message clears, staying gone on reopening', async () => {
    const { user, input } = await beginRename()
    await user.clear(input)
    await user.type(input, '{Enter}')
    await screen.findByRole('alert')

    await user.type(input, '{Escape}')
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    const rename = screen.getByRole('button', { name: /rename role finance committee/i })

    await user.click(rename)
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    expect(screen.getByRole('textbox', { name: 'Role name' })).toHaveValue('Finance Committee')
    expect(patchCalls()).toHaveLength(0)
  })

  it('saving the unchanged name closes the editor without a request', async () => {
    const { user, input } = await beginRename()
    await user.type(input, '{Enter}')

    expect(await screen.findByRole('button', { name: /rename role finance committee/i })).toBeInTheDocument()
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    expect(patchCalls()).toHaveLength(0)
  })
})
