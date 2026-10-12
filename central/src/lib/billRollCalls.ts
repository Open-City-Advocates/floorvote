import type { CentralMeasure } from '../providers'

/**
 * A provider that sets `replacesRollCalls` says its measure carries all of
 * the bill's roll calls, so its ingest replaces them the way it replaces the
 * bill's history and sponsors: a roll call the bill holds that the measure no
 * longer names is deleted, with its member votes. That is what lets a provider
 * change how it derives roll call ids, or stop emitting a vote, without
 * leaving the old rows beside the new ones. It is opt-in: LegiScan's roll
 * calls are static, with member votes from a dataset, and LIMS's details can
 * answer with no actions, so those ingests only upsert.
 */

/** A stored roll call's fields the ingest compares. */
export interface StoredRollCall {
  rollCallId: number
  date: string
  description: string | null
  yea: number
  nay: number
  chamber: string | null
}

const signature = (v: { date: string; desc?: string | null; description?: string | null; yea?: number | null; nay?: number | null; chamber?: string | null }) =>
  [v.date, v.desc ?? v.description ?? '', v.yea ?? 0, v.nay ?? 0, v.chamber ?? ''].join('|')

/**
 * The roll call ids change detection should treat as already known: every id
 * stored, and every incoming roll call that only re-keys a stored one, since
 * the ingest replaces the stored row. A re-keyed roll call has a new id but
 * the same date, description, tally, and chamber as a stored roll call the
 * measure no longer names. Without this, a provider that re-keys its roll
 * calls would send instances a "vote added" for every old vote of every bill
 * it next ingests.
 */
export function knownRollCallIds(stored: StoredRollCall[], incoming: CentralMeasure['votes']): Set<number> {
  const known = new Set(stored.map(r => r.rollCallId))
  const incomingIds = new Set(incoming.map(v => v.roll_call_id))
  const replaced = new Map<string, number>()
  for (const r of stored) {
    if (!incomingIds.has(r.rollCallId)) replaced.set(signature(r), (replaced.get(signature(r)) ?? 0) + 1)
  }
  for (const v of incoming) {
    const left = replaced.get(signature(v)) ?? 0
    if (known.has(v.roll_call_id) || left === 0) continue
    replaced.set(signature(v), left - 1)
    known.add(v.roll_call_id)
  }
  return known
}

/**
 * Delete the bill's roll calls, and their member votes, whose ids aren't
 * `keep`, while the bill still belongs to `providerId`: a cutover (or its undo)
 * that gave the bill to another provider mid-ingest leaves its roll calls
 * alone. One batch, so none is left half deleted.
 */
export async function deleteOtherRollCalls(d1: D1Database, billId: number, providerId: string, keep: number[]): Promise<void> {
  const ids = JSON.stringify(keep)
  const others = `FROM roll_calls WHERE bill_id = ? AND roll_call_id NOT IN (SELECT value FROM json_each(?))
    AND EXISTS (SELECT 1 FROM bills WHERE bill_id = ? AND provider = ?)`
  await d1.batch([
    d1.prepare(`DELETE FROM roll_call_votes WHERE roll_call_id IN (SELECT roll_call_id ${others})`).bind(billId, ids, billId, providerId),
    d1.prepare(`DELETE ${others}`).bind(billId, ids, billId, providerId),
  ])
}
