import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { OtherSessionNotice } from './BillChoices'

const SPECIAL_1 = { state: 'MD', sessionSlug: '2026-s1', session: '2026 Special Session 1', billNumber: 'HB5' }

describe('OtherSessionNotice', () => {
  // /MD/2026/HB5 is the regular session's HB5, and was the special session's
  // too before special sessions had their own slug.
  it('links to the bill an older link to this address may have meant', () => {
    render(<MemoryRouter><OtherSessionNotice choices={[SPECIAL_1]} /></MemoryRouter>)
    expect(screen.getByRole('note')).toHaveTextContent(/older links to this address may have meant this bill/i)
    expect(screen.getByRole('link', { name: 'HB5, 2026 Special Session 1 (MD)' })).toHaveAttribute('href', '/MD/2026-s1/HB5')
  })

  it('shows nothing when no other bill was meant', () => {
    render(<MemoryRouter><OtherSessionNotice choices={[]} /></MemoryRouter>)
    expect(screen.queryByRole('note')).toBeNull()
  })
})
