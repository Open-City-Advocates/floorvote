import { describe, it, expect } from 'vitest'
import { isValidEmail, trimEmailPunctuation } from './email'

describe('isValidEmail', () => {
  it('accepts ordinary addresses', () => {
    for (const e of ['jane@example.com', 'jane.doe+tag@mail.example.co.uk', "o'brien@example.org", 'a-b_c@sub-domain.example.gov']) {
      expect(isValidEmail(e), e).toBe(true)
    }
  })

  it('accepts internationalized domains', () => {
    expect(isValidEmail('jane@münchen.de')).toBe(true)
  })

  it('rejects trailing punctuation left over from a copied list', () => {
    for (const e of ['jane@example.gov;', 'jane@example.gov.', 'jane@example.gov,', 'jane@example.gov)', 'jane@example.gov>']) {
      expect(isValidEmail(e), e).toBe(false)
    }
  })

  it('rejects structurally broken addresses', () => {
    for (const e of ['', 'not-an-email', 'jane@', '@example.com', 'jane@example', 'jane@@example.com', 'jane doe@example.com', 'jane@example.c0m', 'jane@-example.com', 'a@x.gov;b@y.gov']) {
      expect(isValidEmail(e), e).toBe(false)
    }
  })
})

describe('trimEmailPunctuation', () => {
  it('strips punctuation from both ends', () => {
    expect(trimEmailPunctuation('jane@example.gov;')).toBe('jane@example.gov')
    expect(trimEmailPunctuation('jane@example.gov.')).toBe('jane@example.gov')
    expect(trimEmailPunctuation('(jane@example.gov);')).toBe('jane@example.gov')
    expect(trimEmailPunctuation(' "jane@example.gov", ')).toBe('jane@example.gov')
  })

  it('leaves interior punctuation alone', () => {
    expect(trimEmailPunctuation('jane.doe@example.gov')).toBe('jane.doe@example.gov')
  })
})
