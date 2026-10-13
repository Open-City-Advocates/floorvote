import type { Context, Hono } from 'hono'
import { directoryRouter } from './directoryApi'
import { crmRouter } from './crmApi'
import { deepRouter } from './deepApi'
import { linksRouter } from './linksApi'
import { fireDeepWorker, reconcileDeepRequests, requestDeepForPrioritized } from './deepAnalysis'
import type { AppDb, AppEnv, Env } from '../types'

// OCA's hooks into the tenant Worker, each called from one line in an upstream
// file so an upstream merge only has those lines to keep
// (docs/internal/fork-upgrade.md, "Keep Fork Features Separate").

/** The fork's env vars, joined to upstream's Env in src/types.ts. */
export type OcaEnv = {
  DEEP_ANALYSIS_ENABLED?: string     // "true" turns on the deep-analysis queue
  DEEP_ANALYSIS_PRIORITIES?: string  // priorities analysed automatically, comma-separated. Unset = "high,medium"
  DEEP_WORKER_TOKEN?: string         // secret: bearer token the external deep-analysis worker presents
  DEEP_WORKER_FIRE_URL?: string      // optional: POSTed when requests are waiting, e.g. a Claude Code routine's /fire URL
  DEEP_WORKER_FIRE_TOKEN?: string    // secret: bearer token for DEEP_WORKER_FIRE_URL
}

/** The fork's routes: the DC Council directory and CRM, deep analyses and hearing briefs, and team links. */
export function registerOcaRoutes(app: Hono<AppEnv>) {
  app.route('/api/directory', directoryRouter)
  app.route('/api/crm', crmRouter)
  app.route('/api/deep', deepRouter)
  app.route('/api/links', linksRouter)
}

/**
 * The hourly deep-analysis sweep. Runs after the body-event sync, in the same
 * job, so a new Council event gets its hearing brief request that hour.
 * Logged rather than thrown, like the jobs around it.
 */
export async function runOcaHourly(env: Env, db: AppDb) {
  try {
    const d = await reconcileDeepRequests(env, db)
    if (d && (d.bills || d.hearings || d.withdrawn)) console.log(`[deep] requested bills=${d.bills} hearings=${d.hearings} withdrawn=${d.withdrawn}`)
    if (await fireDeepWorker(env, db)) console.log('[deep] started the worker')
  } catch (err) {
    console.error(`[deep] request sweep failed, skipping this run: ${causeChain(err)}`)
  }
}

/** After a priority change, singly or in bulk: request a deep analysis at an automatic priority, or withdraw a waiting one below it. */
export function ocaPriorityChanged(c: Context<AppEnv>, db: AppDb, billIds: string[]) {
  c.executionCtx.waitUntil(requestDeepForPrioritized(c.env, db, billIds)
    .catch(err => console.error('[deep] request after priority change failed', err)))
}

// A copy of src/index.ts's describeErrorCauseChain, which isn't exported: Drizzle
// hangs the real D1 error off `.cause`, so this joins every message in the chain.
function causeChain(err: unknown): string {
  const messages: string[] = []
  const seen = new Set<unknown>()
  let current: unknown = err
  while (current != null && !seen.has(current)) {
    seen.add(current)
    messages.push(current instanceof Error ? current.message : String(current))
    current = current instanceof Error ? current.cause : undefined
  }
  return messages.join(' | caused by: ')
}
