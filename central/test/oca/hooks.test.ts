import { env } from 'cloudflare:test'
import { describe, it, expect, vi } from 'vitest'

// The fork's cron hook in src/index-legiscan.ts (runOcaCrons). An upstream
// merge that drops it would stop the directory, seat, and term refresh with
// no error anywhere. The route hook is checked in directory-job.test.ts.
vi.mock('../../src/lib/jobAlert', () => ({ runJob: vi.fn(async () => undefined) }))

import worker from '../../src/index-legiscan'
import { runJob } from '../../src/lib/jobAlert'

describe('the fork\'s hooks into central', () => {
  it('runs the dc-directory job on the cron', async () => {
    const pending: Promise<unknown>[] = []
    const ctx = { waitUntil: (p: Promise<unknown>) => { pending.push(p) }, passThroughOnException: () => {} } as unknown as ExecutionContext
    await worker.scheduled({} as ScheduledEvent, env as never, ctx)
    await Promise.all(pending)
    expect(vi.mocked(runJob).mock.calls.map(c => c[1])).toContain('dc-directory')
  })
})
