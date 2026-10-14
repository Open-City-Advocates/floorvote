import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'
import * as api from '../lib/api'
import { ApiError } from '../lib/api'
import { ConfirmEmailChange, EmailChangeNotMe } from './ConfirmEmailChange'

afterEach(() => {
  vi.restoreAllMocks()
  document.head.querySelectorAll('meta[name="referrer"]').forEach(m => m.remove())
})

type Status = { status: 'valid'; email: string } | { status: 'expired' } | { status: 'invalid' }

/** Route apiFetch: the status GET answers `status`; the confirm POST answers `confirm`. */
function server(status: Status, confirm: unknown = { ok: true, email: 'jane@newjob.org' }) {
  return vi.spyOn(api, 'apiFetch').mockImplementation(async (path: string) => {
    if (path === '/auth/email-change/status') return status as never
    if (path === '/auth/email-change/confirm') {
      if (confirm instanceof Error) throw confirm
      return confirm as never
    }
    throw new Error(`unexpected ${path}`)
  })
}

const posts = (spy: ReturnType<typeof server>) => spy.mock.calls.filter(c => c[0] === '/auth/email-change/confirm')

const statusCalls = (spy: ReturnType<typeof server>) => spy.mock.calls.filter(c => c[0] === '/auth/email-change/status')

const renderPage = (token = 'abc123') => {
  // The router reads the URL it is given; the real address bar is what a
  // browser would show, and what ends up in history and logs.
  window.history.replaceState({}, '', `/auth/confirm-email?token=${token}`)
  return render(<MemoryRouter initialEntries={[`/auth/confirm-email?token=${token}`]}><ConfirmEmailChange /></MemoryRouter>)
}

describe('ConfirmEmailChange', () => {
  it('loading the page only reads the status: it shows the new address and a button, and posts nothing', async () => {
    const spy = server({ status: 'valid', email: 'jane@newjob.org' })
    renderPage()
    expect(await screen.findByRole('button', { name: 'Confirm new email' })).toBeInTheDocument()
    expect(screen.getByText('jane@newjob.org')).toBeInTheDocument()
    expect(statusCalls(spy)).toEqual([['/auth/email-change/status', { method: 'POST', body: JSON.stringify({ token: 'abc123' }) }]])
    expect(posts(spy)).toHaveLength(0)
  })

  it('takes the token out of the address bar once read, and still confirms with it', async () => {
    const spy = server({ status: 'valid', email: 'jane@newjob.org' })
    renderPage()
    fireEvent.click(await screen.findByRole('button', { name: 'Confirm new email' }))
    await screen.findByRole('heading', { name: 'Email Changed' })
    expect(window.location.search).toBe('')
    expect(window.location.href).not.toContain('abc123')
    expect(posts(spy)).toEqual([['/auth/email-change/confirm', { method: 'POST', body: JSON.stringify({ token: 'abc123' }) }]])
  })

  it('pressing the button confirms with the token and says the change is done', async () => {
    const spy = server({ status: 'valid', email: 'jane@newjob.org' })
    renderPage()
    fireEvent.click(await screen.findByRole('button', { name: 'Confirm new email' }))
    expect(await screen.findByRole('heading', { name: 'Email Changed' })).toBeInTheDocument()
    expect(screen.getByText(/Your sign-in email is now/)).toHaveTextContent('Your sign-in email is now jane@newjob.org.')
    expect(posts(spy)).toEqual([['/auth/email-change/confirm', { method: 'POST', body: JSON.stringify({ token: 'abc123' }) }]])
  })

  it("shows the server's reason when the confirm is refused", async () => {
    server({ status: 'valid', email: 'jane@newjob.org' }, new ApiError(409, 'That address is already used by another member.'))
    renderPage()
    fireEvent.click(await screen.findByRole('button', { name: 'Confirm new email' }))
    expect(await screen.findByText('That address is already used by another member.')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Confirm new email' })).not.toBeInTheDocument()
  })

  it.each([
    [{ status: 'expired' } as Status, 'This link has expired. Request the change again from your Account page.'],
    [{ status: 'invalid' } as Status, 'This link is no longer valid. It may have been used already, or replaced by a newer request.'],
  ])('offers no button for a dead link (%o)', async (status, message) => {
    const spy = server(status)
    renderPage()
    expect(await screen.findByText(message)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Confirm new email' })).not.toBeInTheDocument()
    expect(posts(spy)).toHaveLength(0)
  })

  it('sends no referrer from the page', async () => {
    server({ status: 'valid', email: 'jane@newjob.org' })
    renderPage()
    await screen.findByRole('button', { name: 'Confirm new email' })
    expect(document.head.querySelector('meta[name="referrer"]')?.getAttribute('content')).toBe('no-referrer')
  })

  it('serves the page with Referrer-Policy: no-referrer', () => {
    // The HTML comes from Workers Assets, not the Worker, so the header is set
    // in the static _headers file.
    const here = dirname(fileURLToPath(import.meta.url))
    const text = readFileSync(resolve(here, '../../public/_headers'), 'utf8')
    expect(text).toMatch(/^\/auth\/confirm-email\n {2}Referrer-Policy: no-referrer$/m)
  })
})

describe('EmailChangeNotMe', () => {
  it('tells the member to contact an admin', () => {
    render(<MemoryRouter><EmailChangeNotMe /></MemoryRouter>)
    expect(screen.getByRole('heading', { name: "Didn't Ask for This Change?" })).toBeInTheDocument()
    expect(screen.getByText(/contact one of your FloorVote admins right away/)).toBeInTheDocument()
  })
})

