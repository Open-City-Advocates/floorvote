import type { DemoSeed } from './types'
import { LAKE_MICHIGAN_SEED } from './lakeMichigan'
import { OCA_DEMO_SEEDS } from '../../oca/demoSeeds' // OCA fork hook: DC demo seeds

export type { DemoSeed } from './types'

export const DEMO_SEEDS: Record<string, DemoSeed> = {
  'lake-michigan': LAKE_MICHIGAN_SEED,
  ...OCA_DEMO_SEEDS,
}

/** Used when a demo tenant leaves DEMO_SEED unset. */
export const DEFAULT_DEMO_SEED = 'lake-michigan'

export function resolveDemoSeed(slug: string | undefined): DemoSeed {
  const seed = DEMO_SEEDS[slug ?? DEFAULT_DEMO_SEED]
  if (!seed) throw new Error(`Unknown DEMO_SEED "${slug}"`)
  return seed
}
