import { describe, it, expect, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { SaveViewButton } from './SaveViewButton'

// "Save as view" refuses a blank name. Saving one blank must say why (an
// inline "View name is required" message, announced to screen readers and
// tied to the input), keep the popover open, and save nothing.

function renderButton(onSave = vi.fn().mockResolvedValue(undefined)) {
  const user = userEvent.setup()
  render(<SaveViewButton currentSearch="?status=1" onSave={onSave} />)
  return { user, onSave }
}

async function openPopover(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole('button', { name: /save as view/i }))
  return screen.getByRole('textbox', { name: 'View name' })
}

describe('SaveViewButton: blank name', () => {
  it('marks the name input as required and shows no message on open', async () => {
    const { user } = renderButton()
    const input = await openPopover(user)
    expect(input).toHaveAttribute('aria-required', 'true')
    expect(input).not.toHaveAttribute('aria-invalid')
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('keeps Save view enabled, so clicking it can explain itself', async () => {
    const { user } = renderButton()
    await openPopover(user)
    expect(screen.getByRole('button', { name: /^save view$/i })).toBeEnabled()
  })

  it('saving blank shows an inline "required" message and saves nothing', async () => {
    const { user, onSave } = renderButton()
    await openPopover(user)
    await user.click(screen.getByRole('button', { name: /^save view$/i }))

    expect(await screen.findByRole('alert')).toHaveTextContent('View name is required')
    expect(onSave).not.toHaveBeenCalled()
  })

  it('saving whitespace only is treated as blank', async () => {
    const { user, onSave } = renderButton()
    const input = await openPopover(user)
    await user.type(input, '   ')
    await user.click(screen.getByRole('button', { name: /^save view$/i }))

    expect(await screen.findByRole('alert')).toHaveTextContent('View name is required')
    expect(onSave).not.toHaveBeenCalled()
  })

  it('saving blank with Enter shows the message too', async () => {
    const { user, onSave } = renderButton()
    const input = await openPopover(user)
    await user.type(input, '{Enter}')

    expect(await screen.findByRole('alert')).toHaveTextContent('View name is required')
    expect(onSave).not.toHaveBeenCalled()
  })

  it('announces the message and ties it to the input', async () => {
    const { user } = renderButton()
    const input = await openPopover(user)
    await user.click(screen.getByRole('button', { name: /^save view$/i }))

    const alert = await screen.findByRole('alert')
    expect(input).toHaveAttribute('aria-invalid', 'true')
    expect(input).toHaveAttribute('aria-describedby', alert.id)
    expect(input).toHaveAccessibleDescription('View name is required')
  })

  it('keeps the popover open after a blank save', async () => {
    const { user } = renderButton()
    const input = await openPopover(user)
    await user.click(screen.getByRole('button', { name: /^save view$/i }))

    await screen.findByRole('alert')
    expect(screen.getByRole('textbox', { name: 'View name' })).toBe(input)
  })

  it('clears the message once a name is typed, and then saves it', async () => {
    const { user, onSave } = renderButton()
    const input = await openPopover(user)
    await user.click(screen.getByRole('button', { name: /^save view$/i }))
    await screen.findByRole('alert')

    await user.type(input, 'Clerk bills')
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    expect(input).not.toHaveAttribute('aria-invalid')

    await user.click(screen.getByRole('button', { name: /^save view$/i }))
    await waitFor(() => expect(onSave).toHaveBeenCalledWith('Clerk bills'))
    await waitFor(() => expect(screen.queryByRole('textbox', { name: 'View name' })).not.toBeInTheDocument())
  })

  it('keeps the message while only whitespace is typed', async () => {
    const { user } = renderButton()
    const input = await openPopover(user)
    await user.click(screen.getByRole('button', { name: /^save view$/i }))
    await screen.findByRole('alert')

    await user.type(input, '  ')
    expect(screen.getByRole('alert')).toHaveTextContent('View name is required')
  })

  it('Cancel closes the popover and clears the message, which stays gone on reopening', async () => {
    const { user } = renderButton()
    await openPopover(user)
    await user.click(screen.getByRole('button', { name: /^save view$/i }))
    await screen.findByRole('alert')

    await user.click(screen.getByRole('button', { name: /cancel/i }))
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    expect(screen.queryByRole('textbox', { name: 'View name' })).not.toBeInTheDocument()

    const input = await openPopover(user)
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    expect(input).not.toHaveAttribute('aria-invalid')
  })

  it('closing the popover from its trigger also clears the message', async () => {
    const { user } = renderButton()
    await openPopover(user)
    await user.click(screen.getByRole('button', { name: /^save view$/i }))
    await screen.findByRole('alert')

    await user.click(screen.getByRole('button', { name: /save as view/i }))
    await openPopover(user)
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })
})
