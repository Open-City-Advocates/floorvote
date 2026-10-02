import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, within, waitFor, act } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { Profile } from './Profile'
import * as api from '../lib/api'

// The required-field pattern on the Profile card: the name is required. The
// server ignores a blank name and keeps the old one, so the page used to show
// "Saved" and a blank name locally while nothing had changed. Now the Save
// button is blocked with "Missing a required field (*)" and no request goes out.

const auth = vi.hoisted(() => ({ setName: vi.fn(), setSubtitle: vi.fn() }))
vi.mock('../context/AuthContext', () => ({
  useAuth: () => ({
    user: {
      id: 'u1', email: 'a@b.c', name: 'Current Name', role: 'member', subtitle: null,
      canVote: true, emailDigestEnabled: true, emailWeekAheadEnabled: true, lastSeenFeed: null,
      isLastOwner: false,
    },
    loading: false, authError: false,
    setSubtitle: auth.setSubtitle, setName: auth.setName, setEmailDigestEnabled: () => {}, setLastSeenFeed: () => {},
  }),
}))
vi.mock('../context/ConfigContext', () => ({
  useConfig: () => ({ config: { orgNoun: 'coalition' }, multiState: false, loading: false }),
}))
const demoState = vi.hoisted(() => ({ demoLocked: false }))
vi.mock('../context/DemoContext', () => ({
  useDemo: () => ({ demoMode: false, demoLocked: demoState.demoLocked }),
}))

const REASON = 'Missing a required field (*)'

function mockApi({ holdSave = false }: { holdSave?: boolean } = {}) {
  let release: () => void = () => {}
  const patches: Record<string, unknown>[] = []
  vi.spyOn(api, 'apiFetch').mockImplementation(async (path: string, init?: RequestInit) => {
    if (path === '/config') return {} as never
    if (path === '/users/me' && init?.method === 'PATCH') {
      patches.push(JSON.parse(String(init.body)))
      if (holdSave) await new Promise<void>(resolve => { release = resolve })
      return {} as never
    }
    return {} as never
  })
  return { patches, release: () => release() }
}

function setup() {
  const user = userEvent.setup()
  render(<MemoryRouter><Profile /></MemoryRouter>)
  const card = screen.getByRole('heading', { level: 1, name: 'Profile' }).parentElement as HTMLElement
  return { user, card }
}

const nameInput = () => screen.getByLabelText(/^name/i)
const saveButton = (card: HTMLElement) => within(card).getByRole('button', { name: /^(save|saving…)$/i })
const reason = (card: HTMLElement) => within(card).queryByText('Missing a required field')

beforeEach(() => { vi.restoreAllMocks(); auth.setName.mockReset(); auth.setSubtitle.mockReset() })
afterEach(() => { demoState.demoLocked = false })

describe('Profile name is required', () => {
  it('shows a "* Required" legend on the Profile card', () => {
    mockApi()
    const { card } = setup()
    expect(within(card).getByText('Required').parentElement).toHaveTextContent('* Required')
  })

  it('marks the name input with aria-required and a red asterisk', () => {
    mockApi()
    setup()
    expect(nameInput()).toHaveAttribute('aria-required', 'true')
    expect(document.querySelector('label[for="name-input"]')).toHaveTextContent('Name *')
  })

  it('does not mark the subtitle as required', () => {
    mockApi()
    setup()
    expect(screen.getByLabelText(/^subtitle/i)).not.toHaveAttribute('aria-required')
  })

  it('shows no reason while the name is filled', () => {
    mockApi()
    const { card } = setup()
    expect(saveButton(card)).toBeEnabled()
    expect(reason(card)).not.toBeInTheDocument()
    expect(saveButton(card)).not.toHaveAttribute('aria-describedby')
  })

  it('shows the reason beside the disabled Save button once the name is cleared', async () => {
    mockApi()
    const { user, card } = setup()
    await user.clear(nameInput())
    expect(saveButton(card)).toBeDisabled()
    expect(reason(card)?.closest('[id]')).toHaveTextContent(REASON)
    expect(saveButton(card)).toHaveAccessibleDescription('Missing a required field')
  })

  it('hides the reason when a name is typed back in', async () => {
    mockApi()
    const { user, card } = setup()
    await user.clear(nameInput())
    await user.type(nameInput(), 'New Name')
    expect(saveButton(card)).toBeEnabled()
    expect(reason(card)).not.toBeInTheDocument()
  })

  it('treats a whitespace-only name as missing', async () => {
    mockApi()
    const { user, card } = setup()
    await user.clear(nameInput())
    await user.type(nameInput(), '   ')
    expect(saveButton(card)).toBeDisabled()
    expect(reason(card)).toBeInTheDocument()
  })

  it('clearing the name never shows "Saved", sends no request, and keeps the stored name', async () => {
    const { patches } = mockApi()
    const { user, card } = setup()
    await user.clear(nameInput())
    await user.click(saveButton(card))
    await user.keyboard('{Enter}')
    expect(within(card).queryByText('Saved')).not.toBeInTheDocument()
    expect(patches).toHaveLength(0)
    expect(auth.setName).not.toHaveBeenCalled()
  })

  it('still saves and shows "Saved" for a non-blank name', async () => {
    const { patches } = mockApi()
    const { user, card } = setup()
    await user.clear(nameInput())
    await user.type(nameInput(), '  New Name  ')
    await user.click(saveButton(card))
    expect(await within(card).findByText('Saved')).toBeInTheDocument()
    expect(patches).toEqual([{ name: 'New Name', subtitle: null }])
    expect(auth.setName).toHaveBeenCalledWith('New Name')
  })

  it('does not show the reason when Save is disabled only by demo lock', () => {
    demoState.demoLocked = true
    mockApi()
    const { card } = setup()
    expect(saveButton(card)).toBeDisabled()
    expect(reason(card)).not.toBeInTheDocument()
    expect(saveButton(card)).not.toHaveAttribute('aria-describedby')
  })

  it('does not show the reason under demo lock even with the name cleared', async () => {
    demoState.demoLocked = true
    mockApi()
    const { user, card } = setup()
    await user.clear(nameInput())
    expect(saveButton(card)).toBeDisabled()
    expect(reason(card)).not.toBeInTheDocument()
  })

  it('does not show the reason while a save is in flight', async () => {
    const { patches, release } = mockApi({ holdSave: true })
    const { user, card } = setup()
    await user.click(saveButton(card))
    await waitFor(() => expect(patches).toHaveLength(1))
    const busy = within(card).getByRole('button', { name: /saving/i })
    expect(busy).toBeDisabled()
    expect(reason(card)).not.toBeInTheDocument()
    expect(busy).not.toHaveAttribute('aria-describedby')
    await act(async () => { release() })
  })
})
