import { Hono } from 'hono'
import { and, asc, eq, gte, inArray, isNotNull, lte, or } from 'drizzle-orm'
import { getDb } from '../db/client'
import { bills, calendarEventBills, calendarEvents } from '../db/schema'
import { centralFetch } from '../lib/centralFetch'
import { readStateCapabilities } from '../lib/bodyEvents'
import { loadEventRules, saveEventRules } from '../lib/eventRules'
import { parseEventRules, type EventFacets } from '../../../shared/eventRules'
import type { AppEnv } from '../types'

/**
 * Settings → Calendar events (#298): which body events, the legislature's own
 * calendar, the instance shows (lib/eventRules.ts). Mounted under /api/admin,
 * which already requires an admin. The web app offers the page only when a
 * covered state has body events (`capabilities` in GET /config).
 */
export const eventRulesAdminRouter = new Hono<AppEnv>()

/** The committees and kinds central lists for a state (GET /tenants/:tenantId/body-event-options). */
interface StateOptions {
  committees: { committeeId: string; name: string; chamber: string | null }[]
  kinds: { kind: string; types: string[] }[]
}

/** How far ahead the settings page previews the rules. */
const PREVIEW_DAYS = 120

// GET /api/admin/event-rules: the saved rules (null for none: every event
// shows), the committees and kinds to choose from, and the upcoming body
// events, each with what the rules read of it, so the page previews a choice
// before it's saved. The choices are central's lists for each covered state,
// plus any committee or kind the instance's events or saved rules name, so a
// central outage or a committee since gone never drops a choice.
eventRulesAdminRouter.get('/', async (c) => {
  const db = getDb(c.env.DB)
  let states: Record<string, StateOptions> = {}
  let optionsError: string | null = null
  try {
    const res = await centralFetch(c.env, `/tenants/${c.env.TENANT_ID}/body-event-options`)
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const body = await res.json() as { states?: Record<string, StateOptions> }
    states = body.states ?? {}
  } catch (err) {
    console.error('[event-rules] options: central unavailable', err)
    optionsError = 'The lists below may be incomplete: the legislative data service is unavailable right now.'
  }
  const centralCommittees = Object.entries(states).flatMap(([state, o]) => o.committees.map(cm => ({ ...cm, state })))
  const rules = await loadEventRules(db, centralCommittees)

  const today = new Date().toISOString().slice(0, 10)
  const until = new Date(Date.now() + PREVIEW_DAYS * 86_400_000).toISOString().slice(0, 10)
  const rows = await db.select({
    id: calendarEvents.id, date: calendarEvents.date, time: calendarEvents.time, description: calendarEvents.description,
    url: calendarEvents.url, ruleFacets: calendarEvents.ruleFacets,
  }).from(calendarEvents)
    .where(and(eq(calendarEvents.source, 'body'), eq(calendarEvents.status, 'confirmed'), isNotNull(calendarEvents.ruleFacets),
      gte(calendarEvents.date, today), lte(calendarEvents.date, until)))
    .orderBy(asc(calendarEvents.date), asc(calendarEvents.time)).all()
  const tracked = new Set<string>()
  for (let i = 0; i < rows.length; i += 80) {
    const found = await db.selectDistinct({ eventId: calendarEventBills.eventId }).from(calendarEventBills)
      .innerJoin(bills, eq(bills.id, calendarEventBills.billId))
      .where(and(inArray(calendarEventBills.eventId, rows.slice(i, i + 80).map(r => r.id)), or(isNotNull(bills.matchType), isNotNull(bills.priority)))).all()
    for (const f of found) tracked.add(f.eventId)
  }
  const events = rows.map(r => ({
    id: r.id, date: r.date, time: r.time, description: r.description, url: r.url,
    facets: JSON.parse(r.ruleFacets!) as EventFacets, trackedOnAgenda: tracked.has(r.id),
  }))

  // Committees: central's, then any the events or saved rules name that central didn't list.
  const committees: { committeeId: string; name: string; chamber: string | null; state: string | null }[] = [...centralCommittees]
  const addCommittee = (committeeId: string | null, name: string | null) => {
    if (committeeId && name && !committees.some(cm => cm.committeeId === committeeId)) committees.push({ committeeId, name, chamber: null, state: null })
  }
  for (const e of events) addCommittee(e.facets.committeeId, e.facets.committee)
  for (const cm of rules?.committees ?? []) addCommittee(cm.committeeId, cm.name)

  // Kinds, each with its event types: central's for every covered state, and the events'.
  const kinds = new Map<string, Set<string>>()
  const addKind = (kind: string, type: string | null) => {
    const types = kinds.get(kind) ?? new Set<string>()
    if (type) types.add(type)
    kinds.set(kind, types)
  }
  for (const o of Object.values(states)) for (const k of o.kinds) { addKind(k.kind, null); for (const t of k.types) addKind(k.kind, t) }
  for (const e of events) addKind(e.facets.kind, e.facets.type)

  const capabilities = (await readStateCapabilities(db))?.data ?? {}
  return c.json({
    rules,
    hasBodyEvents: Object.values(capabilities).some(cap => cap.bodyEvents),
    committees,
    kinds: [...kinds].map(([kind, types]) => ({ kind, types: [...types].sort((a, b) => a.localeCompare(b)) })),
    events,
    optionsError,
  })
})

// PUT /api/admin/event-rules: save the rules, or clear them with
// {rules: null} so every event shows again. Applied to every body event the
// instance holds in the same batch, without asking central.
eventRulesAdminRouter.put('/', async (c) => {
  const body = await c.req.json<{ rules?: unknown }>().catch(() => ({} as { rules?: unknown }))
  if (body.rules === undefined) return c.json({ error: 'rules is required (null clears them)' }, 400)
  const rules = body.rules === null ? null : parseEventRules(body.rules)
  if (typeof rules === 'string') return c.json({ error: rules }, 400)
  const counts = await saveEventRules(getDb(c.env.DB), rules)
  return c.json({ rules, ...counts })
})
