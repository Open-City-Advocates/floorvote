import { and, eq, isNotNull, isNull } from 'drizzle-orm'
import { bills, billTenants, tenants } from '../db/schema'
import { deliverBatchToTenant, type DeliveryOutcome } from './tenantDelivery'
import { toHandle } from './billHandle'
import type { Db, Env, NotificationMessage } from '../types'

/**
 * Re-send an instance's links as notifications it refreshes from central's
 * bill API: monitor stubs (`stubOnly`) or tracked bills' metadata
 * (`metadataOnly`), optionally only those in one state. No provider calls,
 * and no AI. Behind `/admin/refresh-stubs` and `/admin/refresh-metadata`, and
 * run after a cutover and its undo.
 */
export async function resendTenantLinks(
  env: Env,
  db: Db,
  tenant: { tenantId: string; queueId: string | null },
  opts: { matched: boolean; flag: 'stubOnly' | 'metadataOnly'; state?: string },
): Promise<{ queued: number; via: DeliveryOutcome }> {
  const { tenantId } = tenant
  const matchTypeCond = opts.matched ? isNotNull(billTenants.matchType) : isNull(billTenants.matchType)

  // bill_tenants has no state column, so only join to bills when a state filter
  // is requested — the unscoped query stays identical to the pre-filter query.
  const links = opts.state
    ? await db.select({ billId: billTenants.billId })
      .from(billTenants)
      .innerJoin(bills, eq(bills.billId, billTenants.billId))
      .where(and(eq(billTenants.tenantId, tenantId), matchTypeCond, eq(bills.state, opts.state)))
      .all()
    : await db.select({ billId: billTenants.billId })
      .from(billTenants)
      .where(and(eq(billTenants.tenantId, tenantId), matchTypeCond))
      .all()

  const bodies = links.map(l => ({
    tenantId,
    billId: toHandle(l.billId),
    [opts.flag]: true,
  } as NotificationMessage))

  // Binding-first, HTTP fallback by queue_id for tenants without a static binding.
  const via = await deliverBatchToTenant(env, tenantId, tenant.queueId, bodies)
  return { queued: via === 'dropped' ? 0 : bodies.length, via }
}

/**
 * Re-send the monitor stubs in a state to every active instance covering it,
 * so each shows the status its provider gives now. A cutover and its undo run
 * this once the state's new provider has synced it.
 */
export async function resendStateStubs(
  env: Env,
  db: Db,
  state: string,
): Promise<{ tenantId: string; queued: number; via: DeliveryOutcome }[]> {
  const active = await db.select({ tenantId: tenants.tenantId, stateCoverage: tenants.stateCoverage, queueId: tenants.queueId })
    .from(tenants).where(eq(tenants.active, true)).all()
  const out: { tenantId: string; queued: number; via: DeliveryOutcome }[] = []
  for (const t of active) {
    let coverage: string[]
    try { coverage = JSON.parse(t.stateCoverage) } catch { continue }
    if (!coverage.includes('*') && !coverage.includes(state)) continue
    const sent = await resendTenantLinks(env, db, { tenantId: t.tenantId, queueId: t.queueId ?? null }, { matched: false, flag: 'stubOnly', state })
    if (sent.via === 'dropped') console.warn(`[stubs] no delivery path for tenant ${t.tenantId}; its ${state} stubs weren't re-sent`)
    out.push({ tenantId: t.tenantId, ...sent })
  }
  return out
}
