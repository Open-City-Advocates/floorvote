import { describe, it, expect } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { TermHover } from './TermHover'

const bubble = (text: string) => screen.getAllByText(text).find(el => el.style.position === 'fixed')

describe('TermHover', () => {
  it('shows the explainer on hover and renders no info button', () => {
    render(<TermHover text="A bill that became law.">Chapter</TermHover>)
    expect(screen.queryByRole('button')).toBeNull()
    expect(bubble('A bill that became law.')).toBeUndefined()
    fireEvent.pointerEnter(screen.getByText('Chapter'), { pointerType: 'mouse' })
    expect(bubble('A bill that became law.')).toBeDefined()
    fireEvent.pointerLeave(screen.getByText('Chapter'), { pointerType: 'mouse' })
    expect(bubble('A bill that became law.')).toBeUndefined()
  })

  it('is keyboard focusable and described for screen readers', () => {
    render(<TermHover text="A bill that became law.">Chapter</TermHover>)
    const term = screen.getByText('Chapter')
    expect(term).toHaveAttribute('tabindex', '0')
    expect(term).toHaveAccessibleDescription('A bill that became law.')
    fireEvent.focus(term)
    expect(bubble('A bill that became law.')).toBeDefined()
  })

  it('renders plain text when there is no explainer', () => {
    render(<TermHover text={null}>Chapter</TermHover>)
    const term = screen.getByText('Chapter')
    expect(term).not.toHaveAttribute('tabindex')
    expect(term).not.toHaveAttribute('aria-describedby')
  })
})
