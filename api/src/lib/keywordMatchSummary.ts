import { and, asc, eq, gt, sql } from 'drizzle-orm'
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
// description, and number crosses the D1 boundary. Reading in keyset pages
// keeps each response small and each query on the primary key.
const READ_BATCH = 2000

// How long a fetched corpus is reused. On the largest instance (about 93,000
// bills) one full read is 47 pages and takes seconds, and the summary is
// requested on every pause in typing, so a typing session must pay it once.
//
// TRADE-OFF: a count can lag the database by up to this long. A bill added or
// removed is noticed at once, because the cheap count(*) check below changes,
// but an edit to an existing bill's title or description (or an add paired
// with a remove) is not seen until the TTL runs out. Sync does that rarely
// enough that a minute of lag is invisible next to a count being typed against.
export const CORPUS_TTL_MS = 60_000

// One entry per tenant, held for the life of the isolate. It holds only the
// joined match text per bill (not separate fields), which is the smallest thing
// the matcher can be fed. The promise is cached, not the array, so concurrent
// requests share one read.
type Corpus = { loadedAt: number; texts: Promise<string[]> }
const corpora = new Map<string, Corpus>()

/** Drop every cached corpus. For tests, which reset the database under the cache. */
export function clearKeywordMatchCorpus(): void {
  corpora.clear()
}

async function loadTexts(db: AppDb): Promise<string[]> {
  const texts: string[] = []
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
      texts.push(billMatchText({ title: row.title, description: row.abstract, billNumber: row.billNumber }))
    }
    if (rows.length < READ_BATCH) return texts
    cursor = rows[rows.length - 1].id
  }
}

/**
 * The match text of every non-draft bill, from the isolate's cache while it is
 * fresh. Fresh means younger than the TTL and the same number of bills as now,
 * checked with an index-only count (idx_bills_is_draft) that reads no bill rows.
 */
async function matchTexts(db: AppDb, tenantKey: string): Promise<string[]> {
  const cached = corpora.get(tenantKey)
  if (cached && Date.now() - cached.loadedAt < CORPUS_TTL_MS) {
    const [{ n }] = await db
      .select({ n: sql<number>`count(*)` })
      .from(bills)
      .where(eq(bills.isDraft, false))
      .all()
    try {
      const texts = await cached.texts
      if (texts.length === n) return texts
    } catch {
      // A failed read is not reused; fall through to read again.
    }
  }
  const entry: Corpus = { loadedAt: Date.now(), texts: loadTexts(db) }
  corpora.set(tenantKey, entry)
  try {
    return await entry.texts
  } catch (err) {
    if (corpora.get(tenantKey) === entry) corpora.delete(tenantKey)
    throw err
  }
}

/**
 * Trimmed, non-blank entries. A blank line must not turn `['*', '']` into a
 * list the matcher no longer reads as a lone `*`.
 */
export function cleanKeywords(keywords: string[]): string[] {
  return keywords.map(k => k.trim()).filter(k => k !== '')
}

/**
 * How many bills a keyword list matches, and how that differs from the saved
 * list. Matches on the shared match text and makes no LegiScan or AI calls.
 * `tenantKey` scopes the corpus cache to one instance's database.
 *
 * The baseline for "newly" and "unmatched" is the matcher run over the saved
 * list, not each bill's stored match type: that is the set saving moves from.
 */
export async function summarizeKeywordMatches(
  db: AppDb,
  tenantKey: string,
  proposed: string[],
  saved: string[],
): Promise<KeywordMatchSummary> {
  const next = cleanKeywords(proposed)
  const current = cleanKeywords(saved)
  // Identical lists cannot change any bill, so the second matcher pass is skipped.
  const unchanged = next.length === current.length && next.every((k, i) => k === current[i])
  const texts = await matchTexts(db, tenantKey)

  const summary: KeywordMatchSummary = { total: texts.length, matched: 0, newlyMatched: 0, unmatched: 0 }
  for (const text of texts) {
    const matchesNext = matchesKeywords(text, next)
    if (matchesNext) summary.matched++
    if (unchanged) continue
    const matchesCurrent = matchesKeywords(text, current)
    if (matchesNext && !matchesCurrent) summary.newlyMatched++
    if (!matchesNext && matchesCurrent) summary.unmatched++
  }
  return summary
}
