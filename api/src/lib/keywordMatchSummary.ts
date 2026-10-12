import { and, asc, eq, gt } from 'drizzle-orm'
import { bills } from '../db/schema'
import { matchesKeywords, billMatchText } from './keywords'
import type { AppDb } from '../types'

export type KeywordMatchSummary = {
  /** Bills linked to the instance, analyzed or not. Member drafts are not counted. */
  total: number
  /** Bills the proposed list matches. */
  matched: number
  /** Bills the proposed list matches that the saved list does not. */
  newlyMatched: number
  /** Bills the saved list matches that the proposed list does not. */
  unmatched: number
}

// Rows per read. The matching runs here in JS, so every bill's title,
// description, and number crosses the D1 boundary on each call. Reading in
// keyset pages keeps each response small and each query on the primary key.
const READ_BATCH = 2000

/**
 * Trimmed, non-blank entries. A blank line must not turn `['*', '']` into a
 * list the matcher no longer reads as a lone `*`.
 */
export function cleanKeywords(keywords: string[]): string[] {
  return keywords.map(k => k.trim()).filter(k => k !== '')
}

/**
 * How many bills a keyword list matches, and how that differs from the saved
 * list. Reads only the three columns `billMatchText` needs and makes no
 * LegiScan or AI calls, so it is cheap enough to run as an admin types.
 *
 * The baseline for "newly" and "unmatched" is the matcher run over the saved
 * list, not each bill's stored match type: that is the set saving moves from.
 */
export async function summarizeKeywordMatches(
  db: AppDb,
  proposed: string[],
  saved: string[],
): Promise<KeywordMatchSummary> {
  const next = cleanKeywords(proposed)
  const current = cleanKeywords(saved)
  const summary: KeywordMatchSummary = { total: 0, matched: 0, newlyMatched: 0, unmatched: 0 }

  let cursor = ''
  for (;;) {
    const rows = await db
      .select({ id: bills.id, title: bills.title, abstract: bills.abstract, billNumber: bills.billNumber })
      .from(bills)
      .where(and(eq(bills.isDraft, false), gt(bills.id, cursor)))
      .orderBy(asc(bills.id))
      .limit(READ_BATCH)
      .all()

    for (const row of rows) {
      const text = billMatchText({ title: row.title, description: row.abstract, billNumber: row.billNumber })
      const matchesNext = matchesKeywords(text, next)
      const matchesCurrent = matchesKeywords(text, current)
      summary.total++
      if (matchesNext) summary.matched++
      if (matchesNext && !matchesCurrent) summary.newlyMatched++
      if (!matchesNext && matchesCurrent) summary.unmatched++
    }

    if (rows.length < READ_BATCH) return summary
    cursor = rows[rows.length - 1].id
  }
}
