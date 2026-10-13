import type { Hono } from 'hono'
import { runJob } from '../lib/jobAlert'
import { ocaAdminRoutes, ocaBillsRoutes } from './routes'
import { runDcDirectory } from './directory'
import type { Db, Env } from '../types'

// OCA's hooks into central, each called from one line in src/index-legiscan.ts
// so an upstream merge only has those lines to keep (docs/internal/fork-upgrade.md).

/** The fork's routes. Mounted ahead of upstream's, so /api/bills/:id doesn't answer for /api/bills/council-directory. */
export function registerOcaRoutes(app: Hono<{ Bindings: Env }>) {
  app.route('/api/bills', ocaBillsRoutes)
  app.route('/api/oca', ocaAdminRoutes)
}

/** The fork's jobs on central's hourly cron: the DC Council directory, seats, and terms (runs daily at 5 ET). */
export function runOcaCrons(env: Env, ctx: ExecutionContext, db: Db) {
  ctx.waitUntil(runJob(env, 'dc-directory', () => runDcDirectory(env, db)))
}
