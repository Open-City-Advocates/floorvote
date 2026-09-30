import type { InstanceHint } from '../../shared/instanceHint'
import { LOGO_LOCKUP, LOGO_MARK, logoMarkSvg } from '../../shared/logo'
import { color } from '../../shared/tokens'
import { PRODUCT_NAME_WORDMARK } from '../../shared/brand'

function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

function wordmark(): string {
  const paths = LOGO_MARK.paths.map((d) => `<path d="${d}"/>`).join('')
  return `<div class="wordmark" aria-label="FloorVote"><svg viewBox="${LOGO_MARK.inlineViewBox}" aria-hidden="true">${paths}</svg><span class="floor">${PRODUCT_NAME_WORDMARK.primary}</span><span class="vote">${PRODUCT_NAME_WORDMARK.accent}</span></div>`
}

// Self-contained: no external assets, so the CSP can be default-src 'none'.
// Honey (color.accentAmber) is the brand accent. The favicon is an inline data: URI
// (CSP allows img-src data: only).
function layout(title: string, body: string): string {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex">
<title>${esc(title)}</title>
<link rel="icon" type="image/svg+xml" href="data:image/svg+xml,${encodeURIComponent(logoMarkSvg(color.accentAmber))}">
<style>
  :root { --bg: #fafaf7; --fg: #1c1c1a; --muted: #5f5f5a; --accent: ${color.accentAmber}; --wordmark-floor: ${color.billBadgeNavy}; --card: #fff; --border: #e4e2dc; }
  @media (prefers-color-scheme: dark) {
    :root { --bg: #141412; --fg: #efeee9; --muted: #a8a7a0; --wordmark-floor: var(--fg); --card: #1e1e1b; --border: #34332f; }
  }
  * { box-sizing: border-box; }
  body { margin: 0; min-height: 100vh; display: grid; place-items: center; padding: 16px;
    background: var(--bg); color: var(--fg); font: 16px/1.5 system-ui, -apple-system, sans-serif; }
  main { width: 100%; max-width: 440px; background: var(--card); border: 1px solid var(--border);
    border-radius: 12px; padding: 28px; }
  .wordmark { font-weight: ${LOGO_LOCKUP.weight}; font-size: 1.5rem; letter-spacing: ${LOGO_LOCKUP.letterSpacing};
    line-height: 1; margin: 0 0 20px; white-space: nowrap; }
  .wordmark svg { height: ${LOGO_LOCKUP.markHeightEm}em; width: auto; vertical-align: baseline;
    margin-right: ${LOGO_LOCKUP.gapEm}em; fill: var(--accent); }
  .floor { color: var(--wordmark-floor); }
  .vote { color: var(--accent); }
  h1 { font-size: 1.25rem; margin: 0 0 8px; }
  p { margin: 0 0 16px; color: var(--muted); }
  code { color: var(--fg); }
  .instances { list-style: none; margin: 0; padding: 0; }
  .instances li + li { margin-top: 8px; }
  .instances a { display: block; padding: 12px 14px; border: 1px solid var(--border); border-radius: 8px;
    text-decoration: none; color: var(--fg); }
  .instances a:hover, .instances a:focus-visible { border-color: var(--accent); }
  .instances a:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }
  .org { display: block; font-weight: 600; overflow-wrap: anywhere; }
  .meta { display: block; color: var(--muted); font-size: 0.875rem; overflow-wrap: anywhere; }
  a { color: inherit; }
  .more { margin: 20px 0 0; padding-top: 16px; border-top: 1px solid var(--border); }
</style>
</head>
<body><main>${wordmark()}${body}</main></body>
</html>`
}

// Links, not a <select>: a native select truncates long names, hiding the host and email.
export function renderPicker(hints: InstanceHint[], marketingUrl: string): string {
  const items = hints
    .map((h) => `<li><a href="/go?host=${encodeURIComponent(h.host)}"><span class="org">${esc(h.name)}</span><span class="meta">${esc(h.host)}${h.email ? ` · ${esc(h.email)}` : ''}</span></a></li>`)
    .join('')
  return layout('Choose your FloorVote', `
<h1>Choose your FloorVote</h1>
<p>You've signed in to these on this browser.</p>
<ul class="instances">${items}</ul>
<p class="more">New to FloorVote? <a href="${esc(marketingUrl)}">Learn more at FloorVote.org →</a></p>`)
}

export function renderWelcome(apex: string, marketingUrl: string): string {
  return layout('FloorVote', `
<h1>Looking for your organization's FloorVote?</h1>
<p>Use the link in your invitation email. It looks like <code>yourorg.${esc(apex)}</code>.</p>
<p class="more">New to FloorVote? <a href="${esc(marketingUrl)}">Learn more at FloorVote.org →</a></p>`)
}

export function renderNotFound(homeUrl: string, marketingUrl: string): string {
  return layout('Page not found', `
<h1>Page not found</h1>
<p><a href="${esc(homeUrl)}">Go to the home page</a></p>
<p class="more">New to FloorVote? <a href="${esc(marketingUrl)}">Learn more at FloorVote.org →</a></p>`)
}
