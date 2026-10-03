import type { InstanceHint } from '../../shared/instanceHint'
import { LOGO_LOCKUP, LOGO_MARK, logoMarkSvg } from '../../shared/logo'
import { color, radius, fontSize, fontWeight, shadow } from '../../shared/tokens'
import { PRODUCT_NAME_WORDMARK } from '../../shared/brand'

function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

function wordmark(): string {
  const paths = LOGO_MARK.paths.map((d) => `<path d="${d}"/>`).join('')
  return `<div class="wordmark" aria-label="FloorVote"><svg viewBox="${LOGO_MARK.inlineViewBox}" aria-hidden="true">${paths}</svg><span class="floor">${PRODUCT_NAME_WORDMARK.primary}</span><span class="vote">${PRODUCT_NAME_WORDMARK.accent}</span></div>`
}

// Self-contained: no external assets, so the CSP can be default-src 'none'.
// Mirrors the tenant sign-in look (web/src/pages/Login.tsx) via shared tokens; Honey
// (color.accentAmber) appears only in the logo. Light only, like the app. The favicon
// is an inline data: URI (CSP allows img-src data: only).
function layout(title: string, body: string): string {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="color-scheme" content="light">
<meta name="robots" content="noindex">
<title>${esc(title)}</title>
<link rel="icon" type="image/svg+xml" href="data:image/svg+xml,${encodeURIComponent(logoMarkSvg(color.accentAmber))}">
<style>
  * { box-sizing: border-box; }
  body { margin: 0; min-height: 100vh; padding: 24px 16px; display: flex; flex-direction: column;
    align-items: center; justify-content: center; background: ${color.bgLoginPage};
    color: ${color.textPrimary}; font-family: system-ui, sans-serif; font-size: ${fontSize.base}px; line-height: 1.5; }
  main { width: 100%; max-width: 420px; background: ${color.white}; border: 1px solid ${color.borderDefault};
    border-radius: ${radius.xl}px; box-shadow: ${shadow.sm}; padding: clamp(24px, 6vw, 40px) clamp(20px, 6vw, 48px); }
  .wordmark { font-weight: ${LOGO_LOCKUP.weight}; font-size: ${fontSize.xxxl}px; letter-spacing: ${LOGO_LOCKUP.letterSpacing};
    line-height: 1; margin-bottom: 24px; white-space: nowrap; }
  .wordmark svg { height: ${LOGO_LOCKUP.markHeightEm}em; width: auto; vertical-align: baseline;
    margin-right: ${LOGO_LOCKUP.gapEm}em; fill: ${color.accentAmber}; }
  .floor { color: ${color.billBadgeNavy}; }
  .vote { color: ${color.accentAmber}; }
  h1 { font-size: ${fontSize.xxxl}px; font-weight: ${fontWeight.bold}; color: ${color.textPrimary}; margin: 0 0 8px; }
  p { margin: 0 0 16px; font-size: ${fontSize.base}px; color: ${color.textSlate500}; }
  code { color: ${color.textPrimary}; }
  .instances { list-style: none; margin: 0; padding: 0; }
  .instances li + li { margin-top: 8px; }
  .instances a { display: block; padding: 12px 14px; border: 1px solid ${color.borderDefault}; border-radius: ${radius.md}px;
    text-decoration: none; color: ${color.textPrimary}; }
  .instances a:hover, .instances a:focus-visible { border-color: ${color.billBadgeNavy}; }
  .instances a:focus-visible { outline: 2px solid ${color.billBadgeNavy}; outline-offset: 2px; }
  .org { display: block; font-weight: ${fontWeight.semibold}; color: ${color.textPrimary}; overflow-wrap: anywhere; }
  .meta { display: block; color: ${color.textMuted}; font-size: ${fontSize.sm}px; overflow-wrap: anywhere; }
  a { color: ${color.billBadgeNavy}; }
  .more { margin: 20px 0 0; font-size: ${fontSize.sm}px; color: ${color.textMuted}; }
  .more a { color: ${color.textMuted}; text-decoration: underline; }
</style>
</head>
<body>${wordmark()}<main>${body}</main></body>
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
