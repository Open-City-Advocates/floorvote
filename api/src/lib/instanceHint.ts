import type { Context } from 'hono'
import { getCookie, setCookie, deleteCookie } from 'hono/cookie'
import {
  INSTANCE_HINT_COOKIE, INSTANCE_HINT_MAX_AGE_S,
  parseInstanceHints, serializeInstanceHints, upsertInstanceHint, removeInstanceHint,
} from '../../../shared/instanceHint'
import { getSuperAdminCookieDomain } from './superadmin'
import { parseAppDomains } from './appDomains'
import type { AppEnv } from '../types'

/**
 * Maintain the `fv_instances` reminder cookie (see shared/instanceHint.ts) so the
 * host's bare apex can send a returning visitor back to their instances.
 *
 * Scoped to the same parent domain as the superadmin SSO cookie. Skipped when
 * there is no parent domain (APP_DOMAINS unset, localhost) or when this tenant IS
 * the apex — the apex Worker wouldn't be serving there.
 */
function hintScope(c: Context<AppEnv>): { domain: string; host: string } | null {
  const domain = getSuperAdminCookieDomain(c.env.APP_URL, parseAppDomains(c.env.APP_DOMAINS))
  if (!domain) return null
  let host: string
  try {
    host = new URL(c.env.APP_URL).hostname
  } catch {
    return null
  }
  if (`.${host}` === domain) return null
  return { domain, host }
}

function writeHints(c: Context<AppEnv>, domain: string, value: string): void {
  setCookie(c, INSTANCE_HINT_COOKIE, value, {
    domain, path: '/', secure: true, httpOnly: true, sameSite: 'Lax', maxAge: INSTANCE_HINT_MAX_AGE_S,
  })
}

export function rememberInstance(c: Context<AppEnv>, email?: string): void {
  // A demo tenant is a public sandbox, not an instance anyone belongs to. It
  // forgets itself instead, which also cleans up entries written before this rule.
  if (c.env.DEMO_MODE === 'true') {
    forgetInstance(c)
    return
  }
  const scope = hintScope(c)
  if (!scope) return
  const list = upsertInstanceHint(parseInstanceHints(getCookie(c, INSTANCE_HINT_COOKIE)), {
    host: scope.host,
    name: c.env.ASSOCIATION_NAME ?? c.env.TENANT_ID,
    ...(email ? { email } : {}),
  })
  writeHints(c, scope.domain, serializeInstanceHints(list))
}

// An explicit logout forgets this instance, so a shared computer doesn't show the
// next person which organizations the last one belonged to. Session expiry does not.
export function forgetInstance(c: Context<AppEnv>): void {
  const scope = hintScope(c)
  if (!scope) return
  const list = removeInstanceHint(parseInstanceHints(getCookie(c, INSTANCE_HINT_COOKIE)), scope.host)
  if (list.length === 0) {
    deleteCookie(c, INSTANCE_HINT_COOKIE, { domain: scope.domain, path: '/', secure: true, httpOnly: true, sameSite: 'Lax' })
    return
  }
  writeHints(c, scope.domain, serializeInstanceHints(list))
}
