import { describe, it, expect, vi, afterEach } from 'vitest'
import worker from '../src/index'
import { serializeInstanceHints } from '../../shared/instanceHint'

const enc = (list: Parameters<typeof serializeInstanceHints>[0]) => encodeURIComponent(serializeInstanceHints(list))
const two = enc([
  { host: 'wi.floor.vote', name: 'Wisconsin Clerks' }, { host: 'mi.floor.vote', name: 'Michigan <Assoc>' },
])
function req(path: string, cookie?: string): Request {
  return new Request(`https://floor.vote${path}`, cookie ? { headers: { Cookie: `fv_instances=${cookie}` } } : {})
}
function mockHealth(ok: boolean) {
  vi.stubGlobal('fetch', vi.fn(async (u: string) => {
    expect(String(u)).toMatch(/^https:\/\/[a-z0-9-]+\.floor\.vote\/api\/health$/)
    return ok ? Response.json({ ok: true }) : new Response('nope', { status: 522 })
  }))
}
afterEach(() => vi.unstubAllGlobals())

describe('apex Worker', () => {
  it('shows the welcome page to a first-time visitor, naming this apex', async () => {
    const res = await worker.fetch(req('/'), {})
    expect(res.status).toBe(200)
    const body = await res.text()
    expect(body).toContain('yourorg.floor.vote')
    expect(body).toContain('https://floorvote.org')
  })

  it('uses MARKETING_URL when set', async () => {
    const body = await (await worker.fetch(req('/'), { MARKETING_URL: 'https://example.org' })).text()
    expect(body).toContain('https://example.org')
  })

  it('sends a visitor with one remembered instance straight there', async () => {
    const one = enc([{ host: 'wi.floor.vote', name: 'WI' }])
    const res = await worker.fetch(req('/', one), {})
    expect(res.status).toBe(302)
    expect(res.headers.get('location')).toBe('https://wi.floor.vote/')
  })

  it('shows a picker with names and subdomains, HTML-escaped', async () => {
    const res = await worker.fetch(req('/', two), {})
    expect(res.status).toBe(200)
    const body = await res.text()
    expect(body).toContain('Wisconsin Clerks · wi.floor.vote')
    expect(body).toContain('Michigan &lt;Assoc&gt; · mi.floor.vote')
    expect(body).not.toContain('<Assoc>')
  })

  it('ignores remembered hosts outside this apex', async () => {
    const evil = enc([{ host: 'evil.com', name: 'x' }, { host: 'wi.floor.vote.evil.com', name: 'y' }])
    const res = await worker.fetch(req('/', evil), {})
    expect(res.status).toBe(200)
    expect(await res.text()).toContain('yourorg.floor.vote')
  })

  it('/go redirects only to a remembered host on this apex', async () => {
    const ok = await worker.fetch(req('/go?host=mi.floor.vote', two), {})
    expect(ok.headers.get('location')).toBe('https://mi.floor.vote/')
    const notRemembered = await worker.fetch(req('/go?host=ny.floor.vote', two), {})
    expect(notRemembered.headers.get('location')).toBe('https://floor.vote/')
  })

  it('/<slug> redirects to an existing instance, keeping the rest of the path', async () => {
    mockHealth(true)
    const res = await worker.fetch(req('/WI/bills/123?x=1'), {})
    expect(res.status).toBe(302)
    expect(res.headers.get('location')).toBe('https://wi.floor.vote/bills/123?x=1')
  })

  it('/<slug> for a missing instance goes to /', async () => {
    mockHealth(false)
    const res = await worker.fetch(req('/nope'), {})
    expect(res.headers.get('location')).toBe('https://floor.vote/')
  })

  it('404s non-slug paths without a health check', async () => {
    const f = vi.fn()
    vi.stubGlobal('fetch', f)
    const res = await worker.fetch(req('/favicon.ico'), {})
    expect(res.status).toBe(404)
    expect(f).not.toHaveBeenCalled()
  })

  it('SINGLE_TENANT_URL sends everything to the one tenant', async () => {
    const res = await worker.fetch(req('/bills?x=1', two), { SINGLE_TENANT_URL: 'https://app.example.org' })
    expect(res.headers.get('location')).toBe('https://app.example.org/bills?x=1')
  })
})
