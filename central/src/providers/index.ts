/**
 * The provider registry: the one place core reaches a provider. Core asks for a
 * provider by id and talks to it through the interface in ./types, which this
 * module re-exports. ESLint keeps core from importing a provider any other way.
 */
import { legiscan } from './legiscan'
import { lims } from './lims'
import { mga } from './mga'
import { lis } from './lis'
import type { ListedCapabilities, Provider } from './types'

export type * from './types'

/** Every provider central knows. A deployment turns on each non-default one by configuration. */
export const PROVIDERS: readonly Provider[] = [legiscan, lims, mga, lis]

/** The provider central uses wherever nothing names another. */
export const DEFAULT_PROVIDER_ID = 'legiscan'

/** The provider with this id. Throws for an id central doesn't know. */
export function getProvider(id: string): Provider {
  const provider = findProvider(id)
  if (!provider) throw new Error(`unknown provider: ${id}`)
  return provider
}

/** The provider with this id, or undefined for an id central doesn't know. */
export function findProvider(id: string | null | undefined): Provider | undefined {
  return PROVIDERS.find(p => p.id === id)
}

/**
 * What a provider supplies, for the State coverage page. Read from the
 * provider's code wherever code shows it, so the page can't claim what a
 * provider doesn't do. lib/capabilities.ts reads `bodyEvents` and `deadlines`
 * from here too, so the page and what tenants receive come from one place.
 */
export function listedCapabilities(provider: Provider): ListedCapabilities {
  return {
    bills: true,
    memberVotes: provider.coverage.memberVotes,
    bodyEvents: !!provider.listBodyEvents,
    billText: provider.coverage.billText,
    extras: Object.keys(provider.vocabulary.extras ?? {}).length > 0,
    deadlines: Object.values(provider.vocabulary.eventTypes).some(t => t.kind === 'deadline'),
  }
}
