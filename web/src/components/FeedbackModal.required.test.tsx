import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { FeedbackModal } from './FeedbackModal'

// The required-field pattern on the feedback form: the message is required,
// and the disabled "Send feedback" button explains itself with
// "Missing a required field (*)".

const apiFetchMock = vi.fn<(path: string, init?: RequestInit) => Promise<unknown>>()

vi.mock('../lib/api', () => ({
  apiFetch: (path: string, init?: RequestInit) => apiFetchMock(path, init),
}))

const REASON = 'Missing a required field (*)'

function renderModal() {
  const root = document.createElement('div'); root.id = 'root'; document.body.appendChild(root)
  return render(<FeedbackModal onClose={() => {}} />, { container: root })
}

const message = () => screen.getByRole('textbox', { name: /message/i })
const sendButton = () => screen.getByRole('button', { name: /send feedback/i })
const reason = () => screen.queryByText('Missing a required field')

beforeEach(() => {
  apiFetchMock.mockReset()
  apiFetchMock.mockResolvedValue(undefined)
  vi.stubGlobal('matchMedia', vi.fn().mockImplementation((query: string) => ({
    matches: false, media: query, onchange: null,
    addEventListener: vi.fn(), removeEventListener: vi.fn(), addListener: vi.fn(), removeListener: vi.fn(), dispatchEvent: vi.fn(),
  })))
})

describe('FeedbackModal required message', () => {
  it('shows a "* Required" legend', () => {
    renderModal()
    expect(screen.getByText('Required').parentElement).toHaveTextContent('* Required')
  })

  it('marks the message with aria-required and a visible red asterisk on its label', () => {
    renderModal()
    expect(message()).toHaveAttribute('aria-required', 'true')
    const label = document.querySelector('label[for="feedback-message"]') as HTMLLabelElement
    expect(label).toHaveTextContent('*')
    // The label is visible now, so the asterisk it carries can be seen.
    expect(label.style.position).not.toBe('absolute')
  })

  it('keeps the message field\'s accessible name free of the asterisk', () => {
    renderModal()
    expect(message()).toHaveAccessibleName('Your message')
  })

  it('shows the reason beside the disabled Send button while the message is empty', () => {
    renderModal()
    expect(sendButton()).toBeDisabled()
    expect(reason()?.closest('[id]')).toHaveTextContent(REASON)
    expect(sendButton()).toHaveAccessibleDescription('Missing a required field')
  })

  it('hides the reason once a message is typed, and brings it back when cleared', async () => {
    const user = userEvent.setup()
    renderModal()
    await user.type(message(), 'Hello')
    expect(sendButton()).toBeEnabled()
    expect(reason()).not.toBeInTheDocument()
    expect(sendButton()).not.toHaveAttribute('aria-describedby')

    await user.clear(message())
    expect(sendButton()).toBeDisabled()
    expect(reason()).toBeInTheDocument()
  })

  it('treats a whitespace-only message as missing', async () => {
    const user = userEvent.setup()
    renderModal()
    await user.type(message(), '   ')
    expect(sendButton()).toBeDisabled()
    expect(reason()).toBeInTheDocument()
  })

  it('does not send a whitespace-only message on Cmd+Enter', () => {
    renderModal()
    fireEvent.change(message(), { target: { value: '   ' } })
    fireEvent.keyDown(message(), { key: 'Enter', metaKey: true })
    expect(apiFetchMock).not.toHaveBeenCalled()
  })

  it('does not show the reason while the message is sending', async () => {
    let release: () => void = () => {}
    apiFetchMock.mockImplementation(() => new Promise<void>(resolve => { release = resolve }))
    renderModal()
    fireEvent.change(message(), { target: { value: 'Hello' } })
    fireEvent.click(sendButton())
    const busy = await screen.findByRole('button', { name: /sending/i })
    expect(busy).toBeDisabled()
    expect(reason()).not.toBeInTheDocument()
    expect(busy).not.toHaveAttribute('aria-describedby')
    await act(async () => { release() })
    await waitFor(() => expect(screen.getByText(/feedback sent/i)).toBeInTheDocument())
  })

  it('shows neither legend nor reason once feedback is sent', async () => {
    renderModal()
    fireEvent.change(message(), { target: { value: 'Hello' } })
    fireEvent.click(sendButton())
    await screen.findByText(/feedback sent/i)
    expect(screen.queryByText('Required')).not.toBeInTheDocument()
    expect(reason()).not.toBeInTheDocument()
  })
})
