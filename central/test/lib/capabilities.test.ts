import { describe, it, expect } from 'vitest'
import { coverageCapabilities, stateCapabilities } from '../../src/lib/capabilities'
import { getProvider, listedCapabilities } from '../../src/providers'

// Pinned expectations. The State coverage page (scripts/gen-state-coverage.ts)
// lists capabilities from `listedCapabilities`, and tenants receive each
// state's capabilities, shaped `{ bodyEvents, deadlines }`, from
// `stateCapabilities`. Changing what a provider can do should change both
// deliberately, so this fails until someone updates the expectation here.
const PINNED = {
  legiscan: { bills: true, memberVotes: true, bodyEvents: false, billText: true, extras: false, deadlines: false },
  lims: { bills: true, memberVotes: true, bodyEvents: true, billText: true, extras: true, deadlines: true },
  mga: { bills: true, memberVotes: false, bodyEvents: false, billText: true, extras: true, deadlines: false },
  lis: { bills: true, memberVotes: true, bodyEvents: false, billText: false, extras: true, deadlines: false },
} as const

describe('what the State coverage page lists', () => {
  it.each(Object.entries(PINNED))('%s', (id, expected) => {
    expect(listedCapabilities(getProvider(id))).toEqual(expected)
  })

  it('agrees with the provider code for the two capabilities LegiScan can show', () => {
    const legiscan = getProvider('legiscan')
    expect(legiscan.coverage.memberVotes).toBe(!!legiscan.listVoteDatasets)
    expect(legiscan.coverage.billText).toBe(!!legiscan.fetchDocument)
  })
})

describe('what tenants receive for a state', () => {
  const owned = (state: string, provider: string) => new Map([[state, provider]])

  it.each([['DC', 'lims'], ['MD', 'mga'], ['VA', 'lis'], ['TX', 'legiscan']])('has the shape { bodyEvents, deadlines } for %s on %s', (state, provider) => {
    const caps = stateCapabilities(owned(state, provider), state)
    expect(Object.keys(caps).sort()).toEqual(['bodyEvents', 'deadlines'])
    const listed = PINNED[provider as keyof typeof PINNED]
    expect(caps).toEqual({ bodyEvents: listed.bodyEvents, deadlines: listed.deadlines })
  })

  it('sends only a state whose provider has body events or deadlines', () => {
    expect(coverageCapabilities(owned('DC', 'lims'), ['DC'])).toEqual({ DC: { bodyEvents: true, deadlines: true } })
    expect(coverageCapabilities(owned('MD', 'mga'), ['MD'])).toEqual({})
    expect(coverageCapabilities(owned('VA', 'lis'), ['VA'])).toEqual({})
    expect(coverageCapabilities(new Map(), ['TX'])).toEqual({})
  })
})
