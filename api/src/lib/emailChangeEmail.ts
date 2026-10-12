import { color, fontSize, radius } from '../../../shared/tokens'
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

/**
 * To the instance's owners and admins, when a member presses "This wasn't me"
 * in an old-address notice. Unlike the notices to the old address, it names
 * both addresses in full: admins can already see every member's address, and
 * they need the new one to judge whose it is.
 */
export function renderEmailChangeReportedEmail(input: {
  appUrl: string
  instanceName: string
  memberName: string
  memberEmail: string
  oldEmail: string
  newEmail: string
  /** Who asked for the change: "the member", or the admin's name and address. */
  requestedBy: string
  /** When it was asked for, already formatted. */
  requestedAt: string
  /** Whether the new address had become the member's sign-in email by the time of the report. */
  tookEffect: boolean
  /** Whether pressing the button cancelled a pending change. */
  cancelledPending: boolean
}): Rendered {
  const subject = `${input.memberName} says they didn't change their sign-in email`
  const href = `${input.appUrl}/admin/members?search=${encodeURIComponent(input.memberEmail)}`
  const intro = `${input.memberName} pressed "This wasn't me" on a notice about a change to their sign-in email${atInstanceText(input.instanceName)}. Every session they had has been signed out.`
  const status = input.tookEffect
    ? `The change had already taken effect. The new address was their sign-in email.${input.cancelledPending ? ' A pending change was also cancelled.' : ''}`
    : input.cancelledPending
      ? 'The pending change was cancelled, so it can no longer be confirmed. Their sign-in email is still the old address.'
      : 'The change had not taken effect, and nothing was pending. Their sign-in email is still the old address.'
  const rows: [string, string][] = [
    ['Member', input.memberName],
    ['Old address', input.oldEmail],
    ['New address', input.newEmail],
    ['Requested by', input.requestedBy],
    ['Requested', input.requestedAt],
  ]
  const advice = "FloorVote does not reverse a change that has taken effect, because the old mailbox may now belong to someone else. Reach the member another way, such as by phone, before you act. An admin can change their email back from Members."
  const footer = 'Sent to every active owner and admin as an account security alert.'

  const table = `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${color.white};border:1px solid ${color.borderDefault};border-radius:${radius.lg}px;margin:0 0 14px;"><tbody>${rows.map(([k, v], i) => `
    <tr><td style="padding:10px 16px;${i > 0 ? `border-top:1px solid ${color.borderDefault};` : ''}font-size:${fontSize.sm}px;color:${color.textSecondary};width:110px;vertical-align:top;">${esc(k)}</td><td style="padding:10px 16px;${i > 0 ? `border-top:1px solid ${color.borderDefault};` : ''}font-size:${fontSize.base}px;color:${color.textPrimary};word-break:break-all;">${esc(v)}</td></tr>`).join('')}
  </tbody></table>`

  const html = renderEmailShell({
    instanceName: input.instanceName,
    appUrl: input.appUrl,
    signalHtml: esc(subject),
    bodyHtml: p(esc(intro)) + table + p(esc(status)) + p(esc(advice), true),
    ctaHtml: emailButton(esc(href), 'Open Members'),
    footerHtml: `${footer}<br>${emailFooterLink(esc(input.appUrl), PRODUCT_NAME)}`,
  })
  const text = `${intro}\n\n${rows.map(([k, v]) => `${k}: ${v}`).join('\n')}\n\n${status}\n\n${advice}\n\nOpen Members: ${href}\n\n${footer}`
  return { subject, html, text }
}
