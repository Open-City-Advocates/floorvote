import { and, eq, isNotNull, isNull, or, sql } from 'drizzle-orm'
import { bills, calendarEvents } from '../db/schema'

/**
 * Which calendar rows the calendar page, the ICS feed, and the dashboard's
 * upcoming count show, for queries that left-join `bills` on
 * calendar_events.bill_id:
 * - a bill's own entries ('hearing') for bills with a priority, so a large
 *   keyword match doesn't flood the calendar, unless a body event the instance
 *   shows covers the entry (covered_by): the event is shown in its place, so
 *   the hearing appears once (lib/bodyEvents.ts). An entry whose cover the
 *   instance's event rules hide shows after all;
 * - a bill's deadlines for every tracked bill (a keyword match, an added bill,
 *   or a prioritized one): they are few, and a missed one costs more than a
 *   crowded day;
 * - custom events;
 * - body events, the legislature's own calendar for covered states, unless the
 *   instance's event rules hide them (rule_match 0, lib/eventRules.ts), and a
 *   fork's 'council' rows (#217) not yet taken over as body events, so its
 *   calendar history stays.
 */
export const visibleCalendarEvent = or(
  and(
    eq(calendarEvents.source, 'hearing'),
    isNotNull(bills.priority),
    or(
      isNull(calendarEvents.coveredBy),
      // A cover whose event the instance doesn't have, or hides, shows the entry after all.
      sql`NOT EXISTS (SELECT 1 FROM calendar_events AS cover WHERE cover.uid = calendar_events.covered_by AND cover.source = 'body' AND cover.rule_match IS NOT 0)`,
    ),
  ),
  and(
    eq(calendarEvents.source, 'hearing'),
    eq(calendarEvents.kind, 'deadline'),
    or(isNotNull(bills.matchType), isNotNull(bills.priority)),
  ),
  eq(calendarEvents.source, 'custom'),
  and(eq(calendarEvents.source, 'body'), sql`${calendarEvents.ruleMatch} IS NOT 0`),
  eq(calendarEvents.source, 'council'),
)!
