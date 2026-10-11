import { DEFAULT_PROVIDER_ID, findProvider, getProvider, type Provider } from '../providers'
import type { Attribution, ProviderCredit } from '../../../shared/dataAttribution'
import { ownerOf, type StateOwners } from './stateProviders'

/**
 * Who an instance credits for its data, from the providers that own the
 * states it covers. Each provider declares its credit in code
 * (`Provider.attribution`), so a provider added or a state claimed changes the
 * instance's footer with no setting and no web code.
 */

function credit(provider: Provider): ProviderCredit {
  return { id: provider.id, ...provider.attribution }
}

/**
 * The credits for a coverage list, one per provider that owns a covered
 * state. `*` covers every state, so it always credits the default provider,
 * which owns each state without a row, and adds the owner of each state that
 * has one. A row naming a provider central has
 * no code for counts as the default's, as it does everywhere else.
 */
export function coverageAttribution(owners: StateOwners, coverage: readonly string[]): Attribution {
  const all = coverage.includes('*')
  const ids = new Set<string>(all ? [DEFAULT_PROVIDER_ID] : [])
  for (const state of [...new Set(all ? owners.keys() : coverage)].sort()) {
    const provider = findProvider(ownerOf(owners, state)) ?? getProvider(DEFAULT_PROVIDER_ID)
    ids.add(provider.id)
  }
  const isDefault = (id: string) => Number(id === DEFAULT_PROVIDER_ID)
  const providers = [...ids].sort((a, b) => isDefault(b) - isDefault(a) || a.localeCompare(b))
    .map(id => credit(getProvider(id)))
  return { providers }
}
