import { isValidEmail, trimEmailPunctuation } from '../../../shared/email'

export type ParsedInvitee = { name?: string; email: string; raw: string }

// An email token after edge cleanup: punctuation stuck to the address by the
// source sheet (`jane@x.gov;`) is stripped, so the preview shows — and the
// server receives — the address that will actually be invited. Same check
// as the api, so what the preview accepts the server accepts.
const asEmail = (t: string): string | null => {
  const cleaned = trimEmailPunctuation(t)
  return isValidEmail(cleaned) ? cleaned.toLowerCase() : null
}

/**
 * Parse pasted roster text into invitees, one per non-blank line.
 *
 * Order-agnostic: on each line the email is whichever token is a valid email
 * once stray edge punctuation is trimmed;
 * everything else on the line (commas, angle brackets, and quotes stripped)
 * becomes the optional name.
 *
 * Accepts: "email", "Name <email>", "Name, email", "email, Name",
 * tab-separated spreadsheet paste in either column order, and quoted names
 * like "Doe, Jane" <j@x.com>.
 *
 * A line with MULTIPLE emails (e.g. a pasted comma list "a@x.com, b@x.com")
 * yields one invitee per email with no name — we can't reliably pair names to
 * emails, and dropping the extras would silently lose invitees.
 *
 * A line with no email token yields { email: '' } so the caller can surface it
 * as an invalid row rather than dropping it silently.
 */
export function parseInvitees(text: string): ParsedInvitee[] {
  const out: ParsedInvitee[] = []
  for (const rawLine of text.split(/\r?\n/)) {
    const raw = rawLine.trim()
    if (!raw) continue

    // Tokens are separated by tabs, commas, or semicolons; <>, and quotes are stripped per token.
    const tokens = raw
      .split(/[\t,;]/)
      .map(t => t.trim().replace(/[<>"]/g, '').trim())
      .filter(t => t.length > 0)

    let emails = tokens.map(asEmail).filter((e): e is string => e !== null)
    let nameParts = tokens.filter(t => asEmail(t) === null)

    // Fallback for "Name <email>" forms where stripping <> merged name + email
    // into a single token (e.g. "Jane Doe jane@example.com"): rescan on spaces.
    if (emails.length === 0) {
      const words = raw.replace(/[<>",;]/g, ' ').split(/\s+/).filter(Boolean)
      emails = words.map(asEmail).filter((e): e is string => e !== null)
      nameParts = words.filter(w => asEmail(w) === null)
    }

    if (emails.length === 0) {
      out.push({ email: '', name: nameParts.join(' ').trim() || undefined, raw })
    } else if (emails.length === 1) {
      const name = nameParts.join(' ').trim()
      out.push({ email: emails[0], name: name || undefined, raw })
    } else {
      // Multiple emails on one line: one invitee each, no reliable name pairing.
      for (const email of emails) out.push({ email, name: undefined, raw })
    }
  }
  return out
}
