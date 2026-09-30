/**
 * The `fv_instances` reminder cookie: which instances this browser has signed
 * in to, so a host's bare apex (e.g. floor.vote) can offer them.
 *
 * Written by each tenant (api/src/lib/instanceHint.ts) scoped to the parent
 * domain; read by the apex Worker (root/src/index.ts). It carries no secret and
 * is never trusted for auth — the worst a tampered value can do is change what
 * the apex page shows its own viewer, and the apex Worker only redirects to its
 * own subdomains.
 *
 * Wire format keeps keys short (`h`, `n`) because every tenant request carries it.
 * These functions work on the DECODED cookie value (plain JSON); callers own the
 * URI encoding (Hono's cookie helpers on the tenant, readCookie in root).
 */
export const INSTANCE_HINT_COOKIE = 'fv_instances'
export const INSTANCE_HINT_MAX_AGE_S = 60 * 60 * 24 * 365

const MAX_ENTRIES = 20
const MAX_NAME = 80

export type InstanceHint = { host: string; name: string }

export function parseInstanceHints(raw: string | undefined): InstanceHint[] {
  if (!raw) return []
  let data: unknown
  try {
    data = JSON.parse(raw)
  } catch {
    return []
  }
  if (!Array.isArray(data)) return []
  const out: InstanceHint[] = []
  for (const e of data) {
    if (e && typeof e === 'object' && typeof e.h === 'string' && e.h && typeof e.n === 'string') {
      out.push({ host: e.h, name: e.n })
    }
  }
  return out.slice(0, MAX_ENTRIES)
}

export function serializeInstanceHints(list: InstanceHint[]): string {
  return JSON.stringify(list.map((h) => ({ h: h.host, n: h.name })))
}

export function upsertInstanceHint(list: InstanceHint[], hint: InstanceHint): InstanceHint[] {
  const fresh = { host: hint.host, name: hint.name.slice(0, MAX_NAME) }
  return [fresh, ...list.filter((h) => h.host !== hint.host)].slice(0, MAX_ENTRIES)
}

export function removeInstanceHint(list: InstanceHint[], host: string): InstanceHint[] {
  return list.filter((h) => h.host !== host)
}
