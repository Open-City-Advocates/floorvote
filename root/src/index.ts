/**
 * The host's bare apex (e.g. floor.vote). Tenants live on subdomains; this
 * Worker only points people at them. It keeps no directory: returning visitors
 * see the instances their own browser remembers (the `fv_instances` cookie each
 * tenant writes — shared/instanceHint.ts), and `/<slug>` works for anyone who
 * already knows the slug. Nothing here names another host; the apex is whatever
 * hostname this request arrived on.
 */
import { INSTANCE_HINT_COOKIE, parseInstanceHints, type InstanceHint } from '../../shared/instanceHint'
import { renderPicker, renderWelcome } from './pages'

export interface Env {
  MARKETING_URL?: string
  // For a host with exactly one tenant: send every apex request there.
  SINGLE_TENANT_URL?: string
}

const SLUG = /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/
const HEALTH_TIMEOUT_MS = 3000
// form-action also covers the redirect after a form submit, so the picker's
// GET /go -> 302 to a tenant subdomain must be allowed explicitly.
const csp = (apex: string) =>
  `default-src 'none'; style-src 'unsafe-inline'; form-action 'self' https://*.${apex}; base-uri 'none'; frame-ancestors 'none'`

function redirect(to: string): Response {
  return new Response(null, { status: 302, headers: { Location: to, 'Cache-Control': 'no-store' } })
}

function html(body: string, apex: string): Response {
  return new Response(body, {
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Content-Security-Policy': csp(apex),
      'X-Content-Type-Options': 'nosniff',
      'Referrer-Policy': 'no-referrer',
      // Varies by cookie, so never share a cached copy between visitors.
      'Cache-Control': 'private, no-store',
    },
  })
}

function readCookie(req: Request, name: string): string | undefined {
  for (const part of (req.headers.get('Cookie') ?? '').split(';')) {
    const i = part.indexOf('=')
    if (i > 0 && part.slice(0, i).trim() === name) {
      try {
        return decodeURIComponent(part.slice(i + 1).trim())
      } catch {
        return undefined
      }
    }
  }
  return undefined
}

// Only this apex's own direct subdomains — a tampered cookie can't point elsewhere.
function ownHints(req: Request, apex: string): InstanceHint[] {
  return parseInstanceHints(readCookie(req, INSTANCE_HINT_COOKIE)).filter((h) => {
    if (!h.host.endsWith(`.${apex}`)) return false
    return SLUG.test(h.host.slice(0, -(apex.length + 1)))
  })
}

async function instanceExists(origin: string): Promise<boolean> {
  try {
    const res = await fetch(`${origin}/api/health`, {
      redirect: 'manual',
      signal: AbortSignal.timeout(HEALTH_TIMEOUT_MS),
    })
    if (!res.ok) {
      await res.body?.cancel()
      return false
    }
    const body = await res.json() as { ok?: unknown }
    return body.ok === true
  } catch {
    return false
  }
}

export default {
  async fetch(req: Request, env: Env): Promise<Response> {
    const url = new URL(req.url)
    if (env.SINGLE_TENANT_URL) {
      const base = new URL(env.SINGLE_TENANT_URL)
      return redirect(base.origin + '/' + url.pathname.replace(/^\/+/, '') + url.search)
    }
    const apex = url.hostname
    const home = `${url.origin}/`
    const marketing = env.MARKETING_URL ?? 'https://floorvote.org'

    if (url.pathname === '/go') {
      const host = url.searchParams.get('host') ?? ''
      const match = ownHints(req, apex).find((h) => h.host === host)
      return redirect(match ? `https://${match.host}/` : home)
    }

    const [first, ...rest] = url.pathname.split('/').filter(Boolean)
    if (first) {
      const slug = first.toLowerCase()
      if (!SLUG.test(slug)) return new Response('Not found', { status: 404 })
      const origin = `https://${slug}.${apex}`
      if (!(await instanceExists(origin))) return redirect(home)
      return redirect(`${origin}/${rest.join('/')}${url.search}`)
    }

    const hints = ownHints(req, apex)
    if (hints.length === 1) return redirect(`https://${hints[0].host}/`)
    if (hints.length > 1) return html(renderPicker(hints, marketing), apex)
    return html(renderWelcome(apex, marketing), apex)
  },
}
