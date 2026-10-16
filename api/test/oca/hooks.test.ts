import { describe, it, expect, vi } from 'vitest'
import { env, createExecutionContext, createScheduledController, waitOnExecutionContext } from 'cloudflare:test'

// The fork's hourly hook in src/index.ts (runOcaHourly). An upstream merge that
// drops it would stop deep-analysis and hearing-brief requests with no error
// anywhere. The route hook is covered by every test that calls /api/deep,
// /api/links, /api/crm, or /api/directory. The demo seed hook in
// src/lib/demoSeeds/index.ts is covered by demoSeeds.dcYouthJustice.test.ts,
// which resolves the seed through upstream's registry, and its offsets hook in
// test/lib/dateFromNow.test.ts by that file's "covers every registered seed".
vi.mock('../../src/lib/healStalledAi', () => ({ healStalledAiBills: vi.fn(async () => ({ queued: 0, cappedOut: 0, remaining: 0 })), HEAL_MAX_ATTEMPTS: 5 }))
vi.mock('../../src/cron/sync', () => ({ registerWithCentral: vi.fn(async () => true) }))
vi.mock('../../src/lib/emailHealthJob', () => ({ runEmailHealth: vi.fn(async () => 'none') }))
vi.mock('../../src/lib/inviteBounces', () => ({ runInviteBounceCheck: vi.fn(async () => []) }))
vi.mock('../../src/lib/bodyEvents', () => ({ syncBodyEvents: vi.fn(async () => null) }))
vi.mock('../../src/oca/deepAnalysis', async (importOriginal) => ({
  ...await importOriginal<typeof import('../../src/oca/deepAnalysis')>(),
  reconcileDeepRequests: vi.fn(async () => null),
  fireDeepWorker: vi.fn(async () => false),
}))

import worker from '../../src/index'
import { reconcileDeepRequests } from '../../src/oca/deepAnalysis'

describe('the fork\'s hooks into the tenant Worker', () => {
  it('runs the deep-analysis sweep on the hourly cron', async () => {
    const ctx = createExecutionContext()
    await worker.scheduled(createScheduledController({ cron: '0 * * * *' }) as unknown as ScheduledEvent, env as never, ctx)
    await waitOnExecutionContext(ctx)
    expect(reconcileDeepRequests).toHaveBeenCalledOnce()
  })
})
