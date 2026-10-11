import { useRouteError, isRouteErrorResponse, useRevalidator, Link } from 'react-router-dom'
import { color, fontSize, fontWeight } from '../styles/tokens'
import { ApiError } from '../lib/api'
import { AcceptTerms } from '../components/AcceptTerms'
import { BillChoiceLinks, billChoicesFrom } from '../components/BillChoices'

/**
 * errorElement for the bill-detail routes. Renders three distinct outcomes
 * thrown by billDetailLoader — a 404 (this URL names no bill), a 409 (more
 * than one bill answers to it, each linked), or a generic load failure — instead of the
 * page crashing. Replaces the old in-component `setError` branch.
 *
 * The 404 case is deliberately not styled as an error. It is reachable from any
 * mistyped URL in the app, because SPA not-found handling routes unmatched paths
 * here and the bill route's three segments match almost anything — so most
 * readers who see it did not ask for a bill at all, and a red failure message
 * tells them something is broken when nothing is.
 */
export function BillDetailError() {
  const error = useRouteError()
  const revalidator = useRevalidator()
  const status = isRouteErrorResponse(error) ? error.status : null

  // These routes carry their own errorElement, which shadows RootErrorBoundary,
  // so the gate has to be handled here too. Accepting revalidates, which re-runs
  // billDetailLoader and lands the reader on the bill they actually asked for.
  if (error instanceof ApiError && error.code === 'terms_not_accepted') {
    return <AcceptTerms onAccepted={() => { void revalidator.revalidate() }} />
  }

  if (status === 404) {
    return (
      <div style={{ padding: 32 }}>
        <div style={{ fontSize: fontSize.lg, fontWeight: fontWeight.semibold, color: color.textPrimary, marginBottom: 6 }}>
          Page not found
        </div>
        <div style={{ fontSize: fontSize.sm, color: color.textSlate, marginBottom: 12 }}>
          This link does not point to a bill. It may be out of date, or mistyped.
        </div>
        <Link to="/bills" style={{ fontSize: fontSize.sm, color: color.linkBlue, textDecoration: 'none' }}>← Back to bills</Link>
      </div>
    )
  }

  // More than one bill answers to this URL: an old link whose slug now
  // belongs to several sessions, or a state-less link to a number several
  // states use. The loader passes the candidates as the error's data.
  if (status === 409) {
    const choices = billChoicesFrom(isRouteErrorResponse(error) ? (error.data as { candidates?: unknown } | null)?.candidates : null)
    return (
      <div style={{ padding: 32 }}>
        <div style={{ fontSize: fontSize.lg, fontWeight: fontWeight.semibold, color: color.textPrimary, marginBottom: 6 }}>
          More than one bill answers to this link
        </div>
        <div style={{ fontSize: fontSize.sm, color: color.textSlate, marginBottom: 12 }}>
          {choices.length > 0 ? 'Choose the one you meant:' : 'Find the bill on the bills page, or use a link with its state and session (e.g. /RI/2026/HB0209).'}
        </div>
        {choices.length > 0 && <div style={{ marginBottom: 12 }}><BillChoiceLinks choices={choices} /></div>}
        <Link to="/bills" style={{ fontSize: fontSize.sm, color: color.linkBlue, textDecoration: 'none' }}>← Back to bills</Link>
      </div>
    )
  }

  return (
    <div style={{ padding: 32, color: color.textErrorRed }}>
      <div style={{ marginBottom: 12 }}>Failed to load bill.</div>
      <Link to="/bills" style={{ fontSize: fontSize.sm, color: color.linkBlue, textDecoration: 'none' }}>← Back to bills</Link>
    </div>
  )
}
