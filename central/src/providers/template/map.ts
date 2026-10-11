import { sha256Hex, type CentralMeasure, type SyncEntry } from '../sdk'
import type { TemplateRecord } from './client'
import { TEMPLATE_STATUS_BASE, vocabulary } from './vocabulary'

/**
 * TEMPLATE: the mapping from the feed's records into central's shapes
 * (`SyncEntry` for the full pass, `CentralMeasure` for the ingest). Keep it
 * pure: no requests and no env, so the mapping test can run it on recorded
 * fixtures alone. Every field the feed sends is either mapped here, set as an
 * extra here, or ignored with a reason in inventory.ts.
 */

/** TEMPLATE: the state this provider serves, as a two-letter code. */
export const TEMPLATE_STATE = 'ZZ'

/** The provider's own key for a measure: unique across its sessions, and never changing. */
export function templateNativeKey(sessionCode: string, number: string): string {
  return `${sessionCode}/${number.replace(/\s+/g, '')}`
}

/**
 * A hash that moves whenever anything the mapping reads does. Leave out
 * fields that change on their own (a file's generated-at timestamp, say), or
 * every pass re-ingests every measure.
 */
export function templateRecordHash(r: TemplateRecord): Promise<string> {
  return sha256Hex(JSON.stringify(r))
}

const STATUS_CODE_BY_LABEL = new Map(Object.entries(vocabulary.statuses).map(([code, s]) => [s.label.toLowerCase(), Number(code)]))

/**
 * The status code for a feed's status name: the vocabulary's code whose label
 * is that name, or TEMPLATE_STATUS_BASE (no status) for a name the
 * vocabulary doesn't list yet. A provider whose feed has no status field
 * derives one from what it has (Maryland's `mgaStatus`, Virginia's `lisStatus`).
 */
export function templateStatus(name: string): number {
  return STATUS_CODE_BY_LABEL.get(name.trim().toLowerCase()) ?? TEMPLATE_STATUS_BASE
}

/** The full-pass entry for one record: enough to keyword-match it, and its change hash. */
export function toTemplateEntry(r: TemplateRecord, billId: number, hash: string): SyncEntry {
  return {
    bill_id: billId,
    number: r.Number.trim(),
    change_hash: hash,
    title: r.Title.trim(),
    description: r.Title.trim(),
    status: templateStatus(r.Status),
    status_date: r.StatusDate,
    last_action: r.Status.trim(),
    last_action_date: r.StatusDate,
    state_link: r.Url,
  }
}

/** One measure's full record. Fill every list the feed has data for, and leave the rest empty. */
export function buildTemplateMeasure(
  r: TemplateRecord,
  billId: number,
  hash: string,
  session: CentralMeasure['session'],
): CentralMeasure {
  return {
    bill_id: billId,
    bill_number: r.Number.trim(),
    title: r.Title.trim(),
    description: r.Title.trim(),
    state: TEMPLATE_STATE,
    state_id: 0,
    change_hash: hash,
    status: templateStatus(r.Status),
    status_date: r.StatusDate,
    // TEMPLATE: a key of vocabulary.billTypes, from the number's prefix or the feed's own type.
    bill_type: 'B',
    bill_type_id: '1',
    body: '',
    body_id: 0,
    current_body: '',
    current_body_id: 0,
    url: r.Url,
    state_link: r.Url,
    pending_committee_id: 0,
    session_id: session.session_id,
    session,
    committee: null,
    referrals: [],
    progress: [],
    sponsors: [],
    history: [{ date: r.StatusDate, action: r.Status.trim(), chamber: '', chamber_id: 0, importance: 1 }],
    sasts: [],
    subjects: [],
    votes: [],
    texts: [],
    amendments: [],
    supplements: [],
    // TEMPLATE: every calendar entry the feed lists, past ones too, or [] when it lists none.
    // Leave `calendar` out only when this answer can't say (see MeasureCalendarEntry).
    calendar: [],
    // TEMPLATE: values of the extras vocabulary.ts declares, by key, such as { lawNumber: r.LawNumber }.
    extras: {},
  }
}
