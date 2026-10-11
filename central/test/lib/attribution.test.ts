import { describe, it, expect } from 'vitest'
import { coverageAttribution } from '../../src/lib/attribution'
import { PROVIDERS } from '../../src/providers'

const owned = (...rows: [string, string][]) => new Map(rows)
const ids = (a: ReturnType<typeof coverageAttribution>) => a.providers.map(p => p.id)

describe('what an instance credits for the states it covers', () => {
  it('credits LegiScan for a state with no owner row, with its CC BY license', () => {
    const a = coverageAttribution(owned(), ['TX'])
    expect(a).toEqual({
      providers: [{
        id: 'legiscan', name: 'LegiScan', url: 'https://legiscan.com',
        note: expect.stringContaining('Creative Commons Attribution 4.0'),
        license: { name: 'CC BY 4.0', url: 'https://creativecommons.org/licenses/by/4.0/' },
      }],
      states: { TX: 'legiscan' },
    })
  })

  it('credits the owner of each covered state, and no one it does not own', () => {
    const owners = owned(['DC', 'lims'], ['MD', 'mga'])
    expect(coverageAttribution(owners, ['DC'])).toMatchObject({ states: { DC: 'lims' }, providers: [{ id: 'lims', name: 'DC Council LIMS' }] })
    expect(ids(coverageAttribution(owners, ['MD', 'DC']))).toEqual(['lims', 'mga'])
    expect(ids(coverageAttribution(owners, ['TX', 'MD']))).toEqual(['legiscan', 'mga'])
  })

  it('credits the default provider first, then the rest by id, once each', () => {
    const owners = owned(['VA', 'lis'], ['DC', 'lims'], ['MD', 'mga'])
    expect(ids(coverageAttribution(owners, ['VA', 'DC', 'MD', 'TX', 'NY']))).toEqual(['legiscan', 'lims', 'lis', 'mga'])
  })

  it('credits the default provider for every state, and each owner, when an instance covers all states', () => {
    expect(ids(coverageAttribution(owned(), ['*']))).toEqual(['legiscan'])
    const a = coverageAttribution(owned(['DC', 'lims']), ['*'])
    expect(ids(a)).toEqual(['legiscan', 'lims'])
    expect(a.states).toEqual({ DC: 'lims' })
  })

  it('treats an owner central has no code for as the default provider', () => {
    expect(coverageAttribution(owned(['DC', 'gone']), ['DC'])).toMatchObject({ states: { DC: 'legiscan' }, providers: [{ id: 'legiscan' }] })
  })
})

describe('every provider\'s declared credit', () => {
  it.each(PROVIDERS.map(p => [p.id, p.attribution] as const))('%s names its publisher, a note, and an https link', (_id, a) => {
    expect(a.name.trim()).not.toBe('')
    expect(a.note.trim()).not.toBe('')
    expect(a.url).toMatch(/^https:\/\//)
    if (a.license) expect(a.license.url).toMatch(/^https:\/\//)
  })
})
