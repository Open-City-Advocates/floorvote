import { color, fontSize } from '../../../shared/tokens'
import { PRODUCT_NAME } from '../../../shared/brand'
import { renderEmailShell, emailButton, emailFooterLink } from './emailShell'

// The emails of an email change (lib/emailChange.ts): the confirmation to the
// new address, and the two account-security notices to the old one. Pure
// renderers, shared by the real sends and the sample registry so the two
// can't drift.

function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

/**
 * An address as the old mailbox may see it: the first character of the local
 * part, then `***`, then the whole domain (`j***@newjob.org`). Whoever holds
 * the old mailbox learns where the account went, but not the inbox itself.
 */
export function maskEmail(address: string): string {
  const at = address.lastIndexOf('@')
  if (at < 1) return '***'
  return `${address[0]}***${address.slice(at)}`
}

const p = (html: string, last = false) =>
  `<p style="margin:0${last ? '' : ' 0 14px'};font-size:${fontSize.base}px;line-height:1.6;color:${color.textSlate};">${html}</p>`

const atInstance = (name: string) => (name ? ` at ${esc(name)}` : '')
const atInstanceText = (name: string) => (name ? ` at ${name}` : '')

type Rendered = { subject: string; html: string; text: string }

/** To the new address: the link to the page that confirms the change. */
export function renderEmailChangeConfirmEmail(input: { appUrl: string; instanceName: string; confirmUrl: string }): Rendered {
  const subject = `Confirm your new email for ${PRODUCT_NAME}`
  const intro = `Someone asked to make this the sign-in email for their ${PRODUCT_NAME} account`
  const after = (how: string) => `If that was you, ${how}, then press Confirm new email on the page it opens. Nothing changes until you do.`
  const expiry = "The link expires in 24 hours and works once. Opening it doesn't sign you in."
  const ignore = "If you didn't ask for this, you can ignore this email. Nobody can use this address to sign in unless it's confirmed."
  const html = renderEmailShell({
    instanceName: input.instanceName,
    appUrl: input.appUrl,
    signalHtml: 'Confirm your new email',
    bodyHtml: p(`${intro}${atInstance(input.instanceName)}. ${after('use the button below')}`) + p(expiry, true),
    ctaHtml: emailButton(esc(input.confirmUrl), 'Confirm new email'),
    footerHtml: `${ignore}<br>${emailFooterLink(esc(input.appUrl), PRODUCT_NAME)}`,
  })
  const text = `${intro}${atInstanceText(input.instanceName)}. ${after('open this link')}\n\n${input.confirmUrl}\n\n${expiry}\n\n${ignore}`
  return { subject, html, text }
}

/**
 * To the old address, when a change is requested (`requested`) and when it
 * takes effect (`changed`). Names the new address only masked. `notMeUrl` is
 * where "This wasn't me" leads.
 */
export function renderEmailChangeNoticeEmail(input: {
  stage: 'requested' | 'changed'
  appUrl: string
  instanceName: string
  newEmail: string
  notMeUrl: string
}): Rendered {
  const masked = maskEmail(input.newEmail)
  const account = `your ${PRODUCT_NAME} account`
  const requested = input.stage === 'requested'
  const subject = requested
    ? `Someone asked to change your ${PRODUCT_NAME} sign-in email`
    : `Your ${PRODUCT_NAME} sign-in email was changed`
  const signal = requested ? 'A change to your sign-in email was requested' : 'Your sign-in email was changed'

  const lead = (m: string, at: string) => requested
    ? `Someone signed in to ${account}${at} asked to change its sign-in email to ${m}. The change takes effect only if it's confirmed from that address within 24 hours. Until then, this address still signs you in.`
    : `The sign-in email for ${account}${at} is now ${m}. This address no longer signs you in, sign-in links already sent here have stopped working, and the account was signed out everywhere except the device that asked for the change.`
  const advice = requested
    ? "If you asked for this, you don't need to do anything. If you didn't, use the link below."
    : "If you made this change, you don't need to do anything. If you didn't, use the link below."
  const footer = "This is an account security notice, so it's sent even if you've turned off other emails."

  const html = renderEmailShell({
    instanceName: input.instanceName,
    appUrl: input.appUrl,
    signalHtml: signal,
    bodyHtml: p(lead(`<strong>${esc(masked)}</strong>`, atInstance(input.instanceName))) + p(advice, true),
    ctaHtml: emailButton(esc(input.notMeUrl), "This wasn't me"),
    footerHtml: `${footer}<br>${emailFooterLink(esc(input.appUrl), PRODUCT_NAME)}`,
  })
  const text = `${lead(masked, atInstanceText(input.instanceName))}\n\n${advice}\n\nThis wasn't me: ${input.notMeUrl}\n\n${footer}`
  return { subject, html, text }
}
