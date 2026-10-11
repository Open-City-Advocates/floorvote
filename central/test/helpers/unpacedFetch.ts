/**
 * `rateLimitedFetch` without the pacing, for provider tests at the main seam,
 * so each request to a stubbed feed doesn't cost the test a second. Each
 * request is still logged through `onRequest`. Replace the real one with:
 *
 *   vi.mock('../../src/lib/rateLimitedFetch', () => import('../helpers/unpacedFetch'))
 *
 * It imports nothing from central, so the mock can load it before anything
 * that uses the real one.
 */
export async function rateLimitedFetch(
  url: string,
  init: RequestInit | undefined,
  opts: { onRequest?: () => void },
): Promise<Response> {
  const res = await fetch(url, init)
  opts.onRequest?.()
  return res
}
