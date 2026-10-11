import { describe, it, expect } from 'vitest'
import { coverageCapabilities, stateCapabilities } from '../../src/lib/capabilities'
import { DEFAULT_PROVIDER_ID, PROVIDERS, listedCapabilities } from '../../src/providers'

// The State coverage page (scripts/gen-state-coverage.ts) lists capabilities
// from `listedCapabilities`. Tenants receive each state's capabilities from
// `stateCapabilities`. These tests fail if the two ever disagree about what a
// provider's states can do, so the published page can't promise what tenants
// don't get.
describe.each(PROVIDERS.map(p => [p.id, p] as const))('%s capabilities', (_id, provider) => {
  // LegiScan serves any state, so one will do.
  const states = provider.states ?? ['TX']
  const listed = listedCapabilities(provider)

  it.each(states)('match what tenants receive for %s', state => {
    const owners = new Map([[state, provider.id]])
    expect(stateCapabilities(owners, state)).toEqual({ bodyEvents: listed.bodyEvents, deadlines: listed.deadlines })
  })

  it.each(states)('reach a tenant covering %s only when the provider has any', state => {
    const sent = coverageCapabilities(new Map([[state, provider.id]]), [state])
    expect(sent[state] !== undefined).toBe(listed.bodyEvents || listed.deadlines)
  })
})

describe('a state with no ownership row', () => {
  it('has the default provider\'s capabilities, which the page lists for every state', () => {
    const listed = listedCapabilities(PROVIDERS.find(p => p.id === DEFAULT_PROVIDER_ID)!)
    expect(stateCapabilities(new Map(), 'TX')).toEqual({ bodyEvents: listed.bodyEvents, deadlines: listed.deadlines })
  })
})
