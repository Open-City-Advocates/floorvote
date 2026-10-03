import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, fireEvent, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ViewSwitcher, type SavedView } from './ViewSwitcher'
import * as api from '../../lib/api'

// Renaming a saved view refuses a blank name. Saving one blank must say why
// (an inline "View name is required" message, announced to screen readers and
// tied to the input), keep the row in its editing state, and rename nothing.

vi.mock('../../context/DemoContext', () => ({
  useDemo: () => ({ demoMode: false, demoLocked: false, settled: true }),
}))

const VIEWS: SavedView[] = [
  { id: 'v1', name: 'Clerk bills', query: 'subject=UT%3AElections' },
  { id: 'v2', name: 'Auditor bills', query: 'subject=UT%3AAudits' },
]

function renderSwitcher(onRename = vi.fn()) {
  const user = userEvent.setup()
  render(
    <ViewSwitcher
      views={VIEWS}
      currentSearch=""
      isAdmin
      onApply={vi.fn()}
      onRename={onRename}
      onDelete={vi.fn()}
      onReorder={vi.fn()}
      onOverwrite={vi.fn()}
    />,
  )
  return { user, onRename }
}

async function beginRename(user: ReturnType<typeof userEvent.setup>, name = 'Clerk bills') {
  await user.click(screen.getByRole('button', { name: /views/i }))
  fireEvent.mouseEnter(screen.getByText(name).closest('div')!)
  await user.click(screen.getByRole('button', { name: `Rename "${name}"` }))
  return screen.getByRole('textbox', { name: 'View name' }) as HTMLInputElement
}

function saveButton() {
  return screen.getByRole('button', { name: /^save$/i })
}

describe('ViewSwitcher rename: blank name', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
    vi.spyOn(api, 'apiFetch').mockResolvedValue({ pagination: { total: 1 } } as never)
  })

  it('marks the name input as required and shows no message on open', async () => {
    const { user } = renderSwitcher()
    const input = await beginRename(user)
    expect(input).toHaveValue('Clerk bills')
    expect(input).toHaveAttribute('aria-required', 'true')
    expect(input).not.toHaveAttribute('aria-invalid')
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('saving blank shows an inline "required" message and renames nothing', async () => {
    const { user, onRename } = renderSwitcher()
    const input = await beginRename(user)
    await user.clear(input)
    await user.click(saveButton())

    expect(await screen.findByRole('alert')).toHaveTextContent('View name is required')
    expect(onRename).not.toHaveBeenCalled()
  })

  it('saving whitespace only is treated as blank', async () => {
    const { user, onRename } = renderSwitcher()
    const input = await beginRename(user)
    await user.clear(input)
    await user.type(input, '   ')
    await user.click(saveButton())

    expect(await screen.findByRole('alert')).toHaveTextContent('View name is required')
    expect(onRename).not.toHaveBeenCalled()
  })

  it('saving blank with Enter shows the message too', async () => {
    const { user, onRename } = renderSwitcher()
    const input = await beginRename(user)
    await user.clear(input)
    await user.type(input, '{Enter}')

    expect(await screen.findByRole('alert')).toHaveTextContent('View name is required')
    expect(onRename).not.toHaveBeenCalled()
  })

  it('announces the message and ties it to the input', async () => {
    const { user } = renderSwitcher()
    const input = await beginRename(user)
    await user.clear(input)
    await user.click(saveButton())

    const alert = await screen.findByRole('alert')
    expect(input).toHaveAttribute('aria-invalid', 'true')
    expect(input).toHaveAttribute('aria-describedby', alert.id)
    expect(input).toHaveAccessibleDescription('View name is required')
  })

  it('keeps the row in its editing state after a blank save', async () => {
    const { user } = renderSwitcher()
    const input = await beginRename(user)
    await user.clear(input)
    await user.click(saveButton())

    await screen.findByRole('alert')
    expect(screen.getByRole('textbox', { name: 'View name' })).toBe(input)
    expect(screen.getByRole('group', { name: 'Saved views' })).toBeInTheDocument()
  })

  it('clears the message once a name is typed, and then renames', async () => {
    const { user, onRename } = renderSwitcher()
    const input = await beginRename(user)
    await user.clear(input)
    await user.click(saveButton())
    await screen.findByRole('alert')

    await user.type(input, 'County clerk bills')
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    expect(input).not.toHaveAttribute('aria-invalid')

    await user.click(saveButton())
    await waitFor(() => expect(onRename).toHaveBeenCalledWith('v1', 'County clerk bills'))
    await waitFor(() => expect(screen.queryByRole('textbox', { name: 'View name' })).not.toBeInTheDocument())
  })

  it('keeps the message while only whitespace is typed', async () => {
    const { user } = renderSwitcher()
    const input = await beginRename(user)
    await user.clear(input)
    await user.click(saveButton())
    await screen.findByRole('alert')

    await user.type(input, '  ')
    expect(screen.getByRole('alert')).toHaveTextContent('View name is required')
  })

  it('Cancel ends the rename and clears the message, which stays gone on renaming again', async () => {
    const { user } = renderSwitcher()
    const input = await beginRename(user)
    await user.clear(input)
    await user.click(saveButton())
    await screen.findByRole('alert')

    await user.click(screen.getByRole('button', { name: /^cancel$/i }))
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    expect(screen.queryByRole('textbox', { name: 'View name' })).not.toBeInTheDocument()

    fireEvent.mouseEnter(screen.getByText('Clerk bills').closest('div')!)
    await user.click(screen.getByRole('button', { name: 'Rename "Clerk bills"' }))
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    expect(screen.getByRole('textbox', { name: 'View name' })).not.toHaveAttribute('aria-invalid')
  })

  it('Escape ends the rename and clears the message', async () => {
    const { user } = renderSwitcher()
    const input = await beginRename(user)
    await user.clear(input)
    await user.click(saveButton())
    await screen.findByRole('alert')

    await user.type(input, '{Escape}')
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    expect(screen.queryByRole('textbox', { name: 'View name' })).not.toBeInTheDocument()
  })

  it('renaming a different view starts without the message', async () => {
    const { user } = renderSwitcher()
    const input = await beginRename(user)
    await user.clear(input)
    await user.click(saveButton())
    await screen.findByRole('alert')
    await user.click(screen.getByRole('button', { name: /^cancel$/i }))

    fireEvent.mouseEnter(screen.getByText('Auditor bills').closest('div')!)
    await user.click(screen.getByRole('button', { name: 'Rename "Auditor bills"' }))
    expect(screen.getByRole('textbox', { name: 'View name' })).toHaveValue('Auditor bills')
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })
})
