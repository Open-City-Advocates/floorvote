import { and, eq, inArray, isNotNull, or } from 'drizzle-orm'
import { associationConfig, bills, calendarEventBills, calendarEvents } from '../db/schema'
import {
  eventMatchesRules, parseEventRules, rulesFromCouncilCalendar, type AgendaBills, type EventFacets, type EventRules,
} from '../../../shared/eventRules'
import { centralFetch } from './centralFetch'
import type { AppDb, Env } from '../types'
import type { CentralBodyEvent } from './bodyEvents'

/**
 * Event rules (#298, shared/eventRules.ts): which body events the instance
 * shows. Stored as JSON in association_config under `event_rules`. With none,
 * every body event of the covered states shows.
 *
 * Each body event keeps what the rules read of it (calendar_events.rule_facets,
 * written by the hourly sync in lib/bodyEvents.ts) and whether the rules
 * select it (rule_match: null with no rules, else 1 or 0). The calendar, ICS
 * feed, and dashboard count hide an event whose rule_match is 0
 * (lib/calendarVisibility.ts), and the week-ahead email takes one whose
 * rule_match is 1. Saving or clearing rules rewrites rule_match locally, in
 * the same batch as the rules themselves, so nothing waits on central and no
 * event is left selected by rules that are gone. The hourly sync applies the
 * rules again, so events new since, and bills tracked or prioritized since,
 * are selected within the hour. Rules never hide an event with a prioritized
 * bill on its agenda, so the calendar and the week-ahead email agree.
 *
 * A fork's teams set their DC Council calendar rules in #217's
 * `council_calendar_rules`. While an instance has no `event_rules`, those are
 * carried over (rulesFromCouncilCalendar) and saved as its event rules, once
 * the instance holds body events whose committees they can name.
 */

export const EVENT_RULES_KEY = 'event_rules'
/** #217's DC Council calendar rules, on a fork's instances. */
export const COUNCIL_RULES_KEY = 'council_calendar_rules'

/** What the rules read of an event central sent. */
export function bodyEventFacets(e: CentralBodyEvent): EventFacets {
  return {
    committeeId: e.committee?.committeeId ?? null,
    committee: e.committee?.name ?? null,
    jointWith: e.jointWith,
    kind: e.kind,
    type: e.type,
    title: e.title,
    topics: e.agenda.map(a => a.topic.trim()).filter(Boolean),
  }
}

function parseFacets(json: string | null): EventFacets | null {
  if (!json) return null
  try {
    const f = JSON.parse(json) as EventFacets
    return f && typeof f.kind === 'string' && typeof f.title === 'string' && Array.isArray(f.topics) ? f : null
  } catch {
    return null
  }
}

/** The committees the instance's body events name, for carrying a fork's rules over. */
async function heldCommittees(db: AppDb): Promise<{ committeeId: string; name: string }[]> {
  const out = new Map<string, string>()
  for (const r of await db.select({ ruleFacets: calendarEvents.ruleFacets }).from(calendarEvents)
    .where(and(eq(calendarEvents.source, 'body'), isNotNull(calendarEvents.ruleFacets))).all()) {
    const f = parseFacets(r.ruleFacets)
    if (f?.committeeId && f.committee) out.set(f.committeeId, f.committee)
  }
  return [...out].map(([committeeId, name]) => ({ committeeId, name }))
}

type CommitteeList = readonly { committeeId: string; name: string }[]

/**
 * The instance's event rules, or null when it has none. A fork's #217 rules
 * are carried over and saved the first time they can be: when the instance
 * holds body events, or central's committee list (`committees`, asked for
 * only then) names some. Stored rules that no longer parse count as none, so
 * every event shows.
 */
export async function loadEventRules(db: AppDb, committees: CommitteeList | (() => Promise<CommitteeList>) = []): Promise<EventRules | null> {
  const rows = await db.select().from(associationConfig)
    .where(inArray(associationConfig.key, [EVENT_RULES_KEY, COUNCIL_RULES_KEY])).all()
  const value = (key: string) => {
    const row = rows.find(r => r.key === key)
    if (!row) return undefined
    try { return JSON.parse(row.value) as unknown } catch { return null }
  }

  const saved = value(EVENT_RULES_KEY)
  if (saved !== undefined) {
    const rules = parseEventRules(saved)
    if (typeof rules === 'string') {
      console.error(`[event-rules] stored rules are invalid, showing every event: ${rules}`)
      return null
    }
    return rules
  }

  const legacy = value(COUNCIL_RULES_KEY)
  if (legacy === undefined) return null
  const known = [...(typeof committees === 'function' ? await committees() : committees), ...await heldCommittees(db)]
  const carried = rulesFromCouncilCalendar(legacy, known)
  if (!carried) return null
  if (known.length > 0) {
    // Saved once, so the team's settings page shows them and edits them from here on.
    await db.insert(associationConfig).values({ key: EVENT_RULES_KEY, value: JSON.stringify(carried) }).onConflictDoNothing()
  }
  return carried
}

/**
 * The committees central lists for the instance's covered states
 * (GET /tenants/:tenantId/body-event-options), or none when central can't say.
 */
export async function centralCommittees(env: Env): Promise<{ committeeId: string; name: string; chamber: string | null; state: string }[]> {
  try {
    const res = await centralFetch(env, `/tenants/${env.TENANT_ID}/body-event-options`)
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const body = await res.json() as { states?: Record<string, { committees?: { committeeId: string; name: string; chamber: string | null }[] }> }
    return Object.entries(body.states ?? {}).flatMap(([state, o]) => (o.committees ?? []).map(c => ({ ...c, state })))
  } catch (err) {
    console.error('[event-rules] central committee list unavailable', err)
    return []
  }
}

function chunks<T>(items: readonly T[], size = 80): T[][] {
  const out: T[][] = []
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size))
  return out
}

export interface RuleCounts {
  /** Body events the rules select (or every one, with no rules). */
  shown: number
  hidden: number
}

const NO_AGENDA_BILLS: AgendaBills = { tracked: false, prioritized: false }

/**
 * Whether each body event has a bill the instance tracks, and one with a
 * priority, on its agenda, by event id (`ids` limits it to those events).
 */
export async function agendaBills(db: AppDb, ids?: readonly string[]): Promise<Map<string, AgendaBills>> {
  const out = new Map<string, AgendaBills>()
  const read = async (only?: readonly string[]) => {
    for (const r of await db.select({ eventId: calendarEventBills.eventId, matchType: bills.matchType, priority: bills.priority })
      .from(calendarEventBills)
      .innerJoin(calendarEvents, eq(calendarEvents.id, calendarEventBills.eventId))
      .innerJoin(bills, eq(bills.id, calendarEventBills.billId))
      .where(and(eq(calendarEvents.source, 'body'), or(isNotNull(bills.matchType), isNotNull(bills.priority)),
        only ? inArray(calendarEventBills.eventId, [...only]) : undefined)).all()) {
      const prior = out.get(r.eventId) ?? NO_AGENDA_BILLS
      out.set(r.eventId, { tracked: true, prioritized: prior.prioritized || r.priority !== null })
    }
  }
  if (!ids) await read()
  else for (const chunk of chunks(ids)) await read(chunk)
  return out
}

/**
 * The statements that set each body event's rule_match under `rules`, and
 * what they leave shown and hidden. Writes only rows whose value changes. An
 * event the sync hasn't described yet (no rule_facets) stays null, and shows,
 * until the next sync describes it.
 */
async function ruleMatchStatements(db: AppDb, rules: EventRules | null) {
  const rows = await db.select({ id: calendarEvents.id, ruleFacets: calendarEvents.ruleFacets, ruleMatch: calendarEvents.ruleMatch })
    .from(calendarEvents).where(eq(calendarEvents.source, 'body')).all()

  const want = new Map<string, number | null>()
  if (rules) {
    const agenda = await agendaBills(db)
    for (const r of rows) {
      const facets = parseFacets(r.ruleFacets)
      want.set(r.id, facets ? (eventMatchesRules(facets, rules, agenda.get(r.id) ?? NO_AGENDA_BILLS) ? 1 : 0) : null)
    }
  } else {
    for (const r of rows) want.set(r.id, null)
  }

  const byValue = new Map<number | null, string[]>()
  const counts: RuleCounts = { shown: 0, hidden: 0 }
  for (const r of rows) {
    const next = want.get(r.id) ?? null
    if (next === 0) counts.hidden++
    else counts.shown++
    if (next === r.ruleMatch) continue
    byValue.set(next, [...(byValue.get(next) ?? []), r.id])
  }
  const statements = [...byValue].flatMap(([value, ids]) => chunks(ids).map(chunk =>
    db.update(calendarEvents).set({ ruleMatch: value }).where(inArray(calendarEvents.id, chunk))))
  return { statements, counts }
}

/** Apply `rules` to every body event the instance holds. */
export async function applyEventRules(db: AppDb, rules: EventRules | null): Promise<RuleCounts> {
  const { statements, counts } = await ruleMatchStatements(db, rules)
  for (const chunk of chunks(statements, 50)) await db.batch(chunk as [typeof chunk[number], ...typeof chunk])
  return counts
}

/**
 * Save the instance's event rules, or clear them with null, and apply them to
 * every body event in the same batch: the rules and what they select change
 * together or not at all. Clearing also drops a fork's #217 rules, so they
 * aren't carried over again.
 */
export async function saveEventRules(db: AppDb, rules: EventRules | null): Promise<RuleCounts> {
  const { statements, counts } = await ruleMatchStatements(db, rules)
  const config = rules
    ? db.insert(associationConfig).values({ key: EVENT_RULES_KEY, value: JSON.stringify(rules) })
      .onConflictDoUpdate({ target: associationConfig.key, set: { value: JSON.stringify(rules) } })
    : db.delete(associationConfig).where(inArray(associationConfig.key, [EVENT_RULES_KEY, COUNCIL_RULES_KEY]))
  await db.batch([config, ...statements])
  return counts
}
