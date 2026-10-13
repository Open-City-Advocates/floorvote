/**
 * Keys for the people in a team's Council CRM. A Councilmember is keyed by
 * name, because LIMS gives a member a new id each Council Period (Trayon White
 * is 187 in CP25 and 199 in CP26). A staffer is keyed by their Council email,
 * or by name and office when the directory lists none.
 */

const SEAT = /^\s*(?:(?:ward\s+\d+|at[\s-]*large)\s+)?(?:councilmember|chairman|chairperson|chair)\s+/i
const SUFFIX = /,?\s+(?:jr|sr|ii|iii|iv)\.?\s*$/i

function plain(s: string): string {
  return s.toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9 ]+/g, ' ').replace(/\s+/g, ' ').trim()
}

/** "Ward 8 Councilmember Trayon White, Sr." and "Trayon White, Sr." → "trayon white". */
export function nameKey(name: string): string {
  return plain(name.replace(SEAT, '').replace(SUFFIX, ''))
}

export function councilmemberKey(name: string): string {
  return `cm:${nameKey(name)}`
}

export function staffKey(p: { email: string | null; name: string; office: string | null }): string {
  const email = (p.email ?? '').trim().toLowerCase()
  return email ? `staff:${email}` : `staff:${nameKey(p.name)}|${plain(p.office ?? '')}`
}

export function isPersonKey(k: string): boolean {
  return /^cm:[a-z0-9 ]{1,200}$/.test(k) || /^staff:[a-z0-9 .@|_+'-]{1,250}$/.test(k)
}

export const CONTACT_KINDS = ['meeting', 'call', 'email', 'testimony', 'event', 'other'] as const
export type ContactKind = typeof CONTACT_KINDS[number]
export const CONTACT_KIND_LABEL: Record<ContactKind, string> = {
  meeting: 'Meeting', call: 'Call', email: 'Email', testimony: 'Testimony', event: 'Event', other: 'Other',
}
