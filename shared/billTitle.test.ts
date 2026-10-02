import { describe, it, expect } from 'vitest'
import { billDisplayTitle, UNTITLED_DRAFT_TITLE } from './billTitle'

describe('billDisplayTitle', () => {
  it('returns a titled draft its own title', () => {
    expect(billDisplayTitle({ title: 'Draft bill title', isDraft: true })).toBe('Draft bill title')
  })

  it('returns a filed bill its own title', () => {
    expect(billDisplayTitle({ title: 'Filed bill title', isDraft: false })).toBe('Filed bill title')
  })

  it.each([
    ['empty', ''],
    ['whitespace-only', '   '],
    ['null', null],
    ['undefined', undefined],
  ])('gives a draft with a %s title the "Untitled draft" label', (_label, title) => {
    expect(billDisplayTitle({ title, isDraft: true })).toBe('Untitled draft')
    expect(UNTITLED_DRAFT_TITLE).toBe('Untitled draft')
  })

  it.each([
    ['empty', ''],
    ['whitespace-only', '   '],
    ['null', null],
  ])('never gives a filed bill with a %s title the fallback', (_label, title) => {
    expect(billDisplayTitle({ title, isDraft: false })).toBe('')
  })

  it('treats a bill with no isDraft flag as filed', () => {
    expect(billDisplayTitle({ title: '' })).toBe('')
    expect(billDisplayTitle({ title: '', isDraft: null })).toBe('')
  })
})
