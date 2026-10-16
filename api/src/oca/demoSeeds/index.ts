import type { DemoSeed } from '../../lib/demoSeeds/types'
import { DC_YOUTH_JUSTICE_SEED } from './dcYouthJustice'

/**
 * OCA's demo seeds, merged into upstream's DEMO_SEEDS by the one hook line in
 * api/src/lib/demoSeeds/index.ts. A tenant picks one with DEMO_SEED.
 */
export const OCA_DEMO_SEEDS: Record<string, DemoSeed> = {
  'dc-youth-justice': DC_YOUTH_JUSTICE_SEED,
}
