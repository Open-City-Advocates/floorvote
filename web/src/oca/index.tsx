import { Link, NavLink, Route } from 'react-router-dom'
import { useConfig } from '../context/ConfigContext'
import { isModifiedClick } from '../lib/modifierClick'
import { color, fontSize, fontWeight, radius, BRAND_FONT } from '../styles/tokens'
import type { CalendarEvent } from '../lib/calendarGrid'
import { People } from './pages/People'
import { PersonRecord } from './pages/PersonRecord'
import { HearingBrief } from './pages/HearingBrief'
import { DeepAnalysisPanel } from './components/DeepAnalysisPanel'
import { TeamLinks } from './components/TeamLinks'
import { BillHearingBriefs } from './components/BillHearingBriefs'

// OCA's hooks into the web app, each used from one line in an upstream file
// so an upstream merge only has those lines to keep
// (docs/internal/fork-upgrade.md, "Keep Fork Features Separate").

/** The fork's pages, inside the signed-in layout in App.tsx. */
export const ocaRoutes = (
  <>
    <Route path="calendar/brief/:eventId" element={<HearingBrief />} />
    <Route path="people" element={<People />} />
    <Route path="people/record/:key" element={<PersonRecord />} />
  </>
)

/** DC teams: the Council's committees and staff, and the team's records of them. */
export function OcaSidebarLinks({ onClose, navHover, setNavHover }: { onClose: () => void; navHover: string | null; setNavHover: (v: string | null) => void }) {
  const { config } = useConfig()
  if (!config?.states.includes('DC')) return null
  return (
    <NavLink
      to="/people"
      onClick={(e) => {
        if (isModifiedClick(e)) return
        onClose()
      }}
      onMouseEnter={() => setNavHover('people')}
      onMouseLeave={() => setNavHover(null)}
      style={({ isActive }) => ({
        display: 'flex', alignItems: 'center', gap: 6,
        padding: '7px 10px',
        fontSize: fontSize.base,
        fontWeight: fontWeight.medium,
        color: isActive ? color.billBadgeNavy : color.textSlate,
        background: isActive || navHover === 'people' ? color.bgAmberPriority : 'transparent',
        textDecoration: 'none',
        borderRadius: radius.md,
        margin: '1px 10px',
      })}
    >
      <span style={{ fontFamily: BRAND_FONT }}>People</span>
    </NavLink>
  )
}

/** A calendar event's hearing brief link. Briefs cover the Council's own events: body events, and older #217 'council' rows. */
export function OcaEventBriefLink({ event }: { event: CalendarEvent }) {
  const deepAnalysis = useConfig().config?.deepAnalysis ?? false
  if (!deepAnalysis || (event.source !== 'body' && event.source !== 'council') || event.status === 'cancelled') return null
  return (
    <Link to={`/calendar/brief/${event.id}`} className="blue-link" style={{ display: 'inline-block', marginTop: 6, fontSize: fontSize.sm }}>
      Hearing brief
    </Link>
  )
}

/** The bill page's deep analysis, team links, and hearing briefs, filled by the operator's worker. Not on drafts. */
export function OcaBillPanels({ bill, isAdmin }: { bill: { id: string; isDraft?: boolean | null }; isAdmin: boolean }) {
  if (bill.isDraft) return null
  return (
    <>
      <DeepAnalysisPanel kind="bill" subjectId={bill.id} isAdmin={isAdmin} />
      <TeamLinks kind="bill" subjectId={bill.id} isAdmin={isAdmin} />
      <BillHearingBriefs billId={bill.id} isAdmin={isAdmin} />
    </>
  )
}
