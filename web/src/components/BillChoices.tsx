import { Link } from 'react-router-dom'
import { color, fontSize, radius } from '../styles/tokens'
import { billUrl } from '../lib/sessionSlug'

/** A bill a URL may have meant, as the bill resolve routes list it. */
export type BillChoice = { state: string; sessionSlug: string; session: string; billNumber: string }

/** Read the `candidates` of a resolve route's 409, dropping anything malformed. */
export function billChoicesFrom(value: unknown): BillChoice[] {
  if (!Array.isArray(value)) return []
  return value.filter((c): c is BillChoice =>
    !!c && typeof c === 'object' && ['state', 'sessionSlug', 'session', 'billNumber'].every(k => typeof (c as Record<string, unknown>)[k] === 'string'))
}

const label = (c: BillChoice) => `${c.billNumber}, ${c.session} (${c.state})`

/** One link per bill, to its canonical URL. */
export function BillChoiceLinks({ choices }: { choices: BillChoice[] }) {
  return (
    <ul style={{ margin: 0, paddingLeft: 20 }}>
      {choices.map(c => {
        const to = billUrl(c)
        return (
          <li key={to} style={{ fontSize: fontSize.sm }}>
            <Link to={to} style={{ color: color.linkBlue, textDecoration: 'none' }}>{label(c)}</Link>
          </li>
        )
      })}
    </ul>
  )
}

/**
 * Shown on a bill reached by a URL that older links used for other bills too:
 * /MD/2026/HB5 was also the address of the 2026 Special Session 1's HB5 before
 * special sessions had their own slug. Points to those bills, so a reader
 * following an old link isn't left on the wrong one without knowing. Most
 * readers arrive by a current link, so it leads with the other bill, and the
 * old-link reason comes second.
 */
export function OtherSessionNotice({ choices }: { choices: BillChoice[] }) {
  if (choices.length === 0) return null
  const one = choices.length === 1
  return (
    <div role="note" style={{ background: color.bgInfo, borderRadius: radius.md, padding: '8px 12px', margin: '0 0 12px', fontSize: fontSize.sm, color: color.textSlate }}>
      <div style={{ marginBottom: 4 }}>{one ? 'Another bill is' : 'Other bills are'} also numbered {choices[0].billNumber}:</div>
      <BillChoiceLinks choices={choices} />
      <div style={{ marginTop: 4 }}>Older links to this page may have meant {one ? 'it' : 'one of them'}.</div>
    </div>
  )
}
