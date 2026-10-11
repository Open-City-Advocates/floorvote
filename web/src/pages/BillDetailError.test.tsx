import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import React from 'react'

const { routeError } = vi.hoisted(() => ({ routeError: { current: null as unknown } }))
const { revalidate } = vi.hoisted(() => ({ revalidate: vi.fn() }))
vi.mock('./AcceptTerms', () => ({ AcceptTerms: () => <div>accept terms screen</div> }))
vi.mock('../components/AcceptTerms', () => ({ AcceptTerms: () => <div>accept terms screen</div> }))
vi.mock('react-router-dom', () => ({
  useRouteError: () => routeError.current,
  useRevalidator: () => ({ revalidate, state: 'idle' }),
  // The router hands the error page a thrown Response as { status, data }.
  isRouteErrorResponse: (e: unknown) => e instanceof Response || (!!e && typeof e === 'object' && 'status' in e && 'data' in e),
  Link: ({ children, to }: { children: React.ReactNode; to: string }) => React.createElement('a', { href: to }, children),
}))

import { BillDetailError } from './BillDetailError'
import { ApiError } from '../lib/api'

function renderFor(status: number) {
  routeError.current = new Response('', { status })
  render(<BillDetailError />)
}

describe('BillDetailError', () => {
  // SPA not-found handling routes every unmatched path into the bill route,
  // whose three segments match almost anything — so most readers who land on
  // the 404 never asked for a bill. Saying a bill failed to load sends them
  // looking for a bill that was never involved.
  it('renders a not-found page for a 404, without claiming a bill broke', () => {
    renderFor(404)
    expect(screen.getByText(/page not found/i)).toBeInTheDocument()
    expect(screen.queryByText(/failed to load bill/i)).not.toBeInTheDocument()
  })

  it('says more than one bill answers on a 409, with guidance when it has no candidates', () => {
    renderFor(409)
    expect(screen.getByText(/more than one bill answers to this link/i)).toBeInTheDocument()
    expect(screen.getByText(/with its state and session/i)).toBeInTheDocument()
  })

  // An old /MD/2026/HB5 link from before special sessions had their own slug
  // can mean bills in two special sessions. Link to each, by its session.
  it("links to each bill a 409's link could mean", () => {
    routeError.current = { status: 409, data: { candidates: [
      { state: 'MD', sessionSlug: '2026-s1', session: '2026 Special Session 1', billNumber: 'HB5' },
      { state: 'MD', sessionSlug: '2026-s2', session: '2026 Special Session 2', billNumber: 'HB5' },
    ] } }
    render(<BillDetailError />)
    expect(screen.getByText('HB5, 2026 Special Session 1 (MD)').getAttribute('href')).toBe('/MD/2026-s1/HB5')
    expect(screen.getByText('HB5, 2026 Special Session 2 (MD)').getAttribute('href')).toBe('/MD/2026-s2/HB5')
  })

  it('still reports a genuine failure on a 500', () => {
    renderFor(500)
    expect(screen.getByText(/failed to load bill/i)).toBeInTheDocument()
  })
})


// Regression: these three routes carry their own errorElement, which SHADOWS
// RootErrorBoundary — so the #187 fix never reaches them. And billDetailLoader
// used to reclassify every unrecognised ApiError as a 500 Response, destroying
// the code the boundary keys on. A reader following a digest-email link while
// the terms gate was armed got "Failed to load bill."
describe('BillDetailError — the terms gate', () => {
  it('shows the interstitial when the bill was refused for terms', () => {
    routeError.current = new ApiError(403, 'Terms not accepted', 'terms_not_accepted')
    render(<BillDetailError />)
    expect(screen.getByText('accept terms screen')).toBeInTheDocument()
    expect(screen.queryByText(/failed to load bill/i)).not.toBeInTheDocument()
  })

  it('still reports a genuine load failure', () => {
    routeError.current = new Response('', { status: 500 })
    render(<BillDetailError />)
    expect(screen.getByText(/failed to load bill/i)).toBeInTheDocument()
    expect(screen.queryByText('accept terms screen')).toBeNull()
  })
})
