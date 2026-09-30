/**
 * The `fv_instances` reminder cookie: which instances this browser has signed
 * in to, so a host's bare apex (e.g. floor.vote) can offer them.
 *
 * Written by each tenant (api/src/lib/instanceHint.ts) scoped to the parent
 * domain; read by the apex Worker (root/src/index.ts). It is not a credential
 * and is never trusted for auth, but it does hold the signed-in email per
 * instance, so logout removes that instance's entry. The worst a tampered value
 * can do is change what the apex page shows its own viewer, and the apex Worker
 * only redirects to its own subdomains. Any server on the parent domain can
 * overwrite this cookie (HttpOnly only blocks scripts); that is acceptable
 * because every subdomain is operator-run.
 *
 * Wire format keeps keys short (`h`, `n`, optional `e` for the signed-in email)
 * because every tenant request carries it. These functions work on the DECODED
 * cookie value (plain JSON); callers own the URI encoding (Hono's cookie
 * helpers on the tenant, readCookie in root).
 */
export const INSTANCE_HINT_COOKIE = 'fv_instances'
export const INSTANCE_HINT_MAX_AGE_S = 60 * 60 * 24 * 365
// Browsers drop cookies over 4096 bytes; stay well under it (URI-encoded length).
export const INSTANCE_HINT_MAX_ENCODED = 3500

const MAX_ENTRIES = 20
const MAX_NAME = 80
const MAX_EMAIL = 254

export type InstanceHint = { host: string; name: string; email?: string }

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
      const hint: InstanceHint = { host: e.h, name: e.n }
      if (typeof e.e === 'string' && e.e) hint.email = e.e
      out.push(hint)
    }
  }
  return out.slice(0, MAX_ENTRIES)
}

export function serializeInstanceHints(list: InstanceHint[]): string {
  return JSON.stringify(list.map((h) => (h.email ? { h: h.host, n: h.name, e: h.email } : { h: h.host, n: h.name })))
}

export function upsertInstanceHint(list: InstanceHint[], hint: InstanceHint): InstanceHint[] {
  const fresh: InstanceHint = { host: hint.host, name: hint.name.slice(0, MAX_NAME) }
  if (hint.email) fresh.email = hint.email.slice(0, MAX_EMAIL)
  const out = [fresh, ...list.filter((h) => h.host !== hint.host)].slice(0, MAX_ENTRIES)
  while (out.length > 1 && encodeURIComponent(serializeInstanceHints(out)).length > INSTANCE_HINT_MAX_ENCODED) out.pop()
  return out
}

export function removeInstanceHint(list: InstanceHint[], host: string): InstanceHint[] {
  return list.filter((h) => h.host !== host)
}
