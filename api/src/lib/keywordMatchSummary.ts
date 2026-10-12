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

// The most characters of match text one instance may keep cached. The corpus
// lives in a 128 MB isolate next to everything else the Worker does. The
// largest instance holds about 31 million characters (93,000 bills), which at
// one byte per character is about 31 MB. Past this limit the corpus is not
// kept: the call that found it too big still answers by matching each page as
// it is read and dropping the page, and so does every later call. Slower, but
// bounded in memory.
export const MAX_CACHED_CHARS = 40_000_000
let maxCachedChars = MAX_CACHED_CHARS

/** Lower the cache limit so a test can cross it without 40 million characters. */
export function setMaxCachedCharsForTest(n: number): void {
  maxCachedChars = n
}

// One entry per tenant, held for the life of the isolate.
type Corpus = { loadedAt: number; texts: string[] }
const corpora = new Map<string, Corpus>()
const warnedTooLarge = new Set<string>()

/** Drop every cached corpus. For tests, which reset the database under the cache. */
export function clearKeywordMatchCorpus(): void {
  corpora.clear()
  warnedTooLarge.clear()
  maxCachedChars = MAX_CACHED_CHARS
}

const FOLD_CHUNK = 8192

/**
 * The text a bill is matched on, folded so V8 can hold it one byte per
 * character: lowercased, with every character outside Latin-1 replaced by a
 * space. V8 stores a string as two bytes per character as soon as one
 * character needs it (a curly quote, an em-dash), and a replace or toLowerCase
 * over such a string stays two-byte even when nothing outside ASCII is left.
 * Only building the string from char codes yields a one-byte one, so that is
 * what this does.
 *
 * Matching on the folded text gives the same answer as matching on the raw text
 * for any keyword list where `isFoldSafe` holds for every keyword:
 *  - The matcher is case-insensitive (the `i` flag) and its token boundary is
 *    ASCII-only, so a non-Latin-1 character is never part of a token and a
 *    space is as good a separator as it was. A keyword with ASCII or Latin-1
 *    characters cannot match inside one: the engine's case folding never maps a
 *    non-ASCII character onto an ASCII one (Kelvin sign, long s), nor onto a
 *    Latin-1 one except the two `isFoldSafe` rules out.
 *  - Characters are lowercased one at a time, and only within ASCII and
 *    Latin-1, because `toLowerCase` on the whole string would turn some
 *    non-Latin-1 characters into Latin-1 ones (the dotted capital I into `i`).
 *  - The two line separators the regex `.` refuses to cross (U+2028, U+2029)
 *    become a newline, not a space, so a `*` still cannot span them.
 */
export function foldForMatch(text: string): string {
  let out = ''
  for (let start = 0; start < text.length; start += FOLD_CHUNK) {
    const end = Math.min(start + FOLD_CHUNK, text.length)
    const codes = new Array<number>(end - start)
    for (let i = start; i < end; i++) {
      const c = text.charCodeAt(i)
      if (c > 255) codes[i - start] = c === 0x2028 || c === 0x2029 ? 10 : 32
      else if ((c >= 65 && c <= 90) || (c >= 192 && c <= 222 && c !== 215)) codes[i - start] = c + 32
      else codes[i - start] = c
    }
    out += String.fromCharCode.apply(null, codes)
  }
  return out
}

/**
 * True when matching this keyword against folded text cannot differ from
 * matching it against raw text: every character is Latin-1, and none has an
 * upper-case form outside Latin-1 (`ÿ` and `µ`, which the `i` flag would match
 * against `Ÿ` and `Μ` in raw text, where folding has already made them spaces).
 */
export function isFoldSafe(keyword: string): boolean {
  for (let i = 0; i < keyword.length; i++) {
    if (keyword.charCodeAt(i) > 255) return false
    const upper = keyword[i].toUpperCase()
    for (let j = 0; j < upper.length; j++) if (upper.charCodeAt(j) > 255) return false
  }
  return true
}

/**
 * Trimmed, non-blank entries. A blank line must not turn `['*', '']` into a
 * list the matcher no longer reads as a lone `*`.
 */
export function cleanKeywords(keywords: string[]): string[] {
  return keywords.map(k => k.trim()).filter(k => k !== '')
}

type Tally = { next: string[]; current: string[]; unchanged: boolean; summary: KeywordMatchSummary }

function tally(t: Tally, text: string): void {
  t.summary.total++
  const matchesNext = matchesKeywords(text, t.next)
  if (matchesNext) t.summary.matched++
  if (t.unchanged) return
  const matchesCurrent = matchesKeywords(text, t.current)
  if (matchesNext && !matchesCurrent) t.summary.newlyMatched++
  if (!matchesNext && matchesCurrent) t.summary.unmatched++
}

/**
 * One pass over every non-draft bill, a page at a time. Each page is matched
 * and then dropped, so rows never pile up. When `keep` is set it also builds
 * the folded corpus, which it returns unless the corpus outgrew the limit.
 * Matching here always runs on the raw text, so this pass is exact for any
 * keywords.
 */
async function readAll(db: AppDb, t: Tally, keep: boolean, tenantKey: string): Promise<string[] | null> {
  let texts: string[] | null = keep ? [] : null
  let chars = 0
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
      tally(t, text)
      if (texts) {
        chars += text.length
        if (chars > maxCachedChars) {
          texts = null
          if (!warnedTooLarge.has(tenantKey)) {
            warnedTooLarge.add(tenantKey)
            console.warn(`[keyword-match-summary] bill text exceeds ${maxCachedChars} characters, so it is not cached and every count re-reads the bills`)
          }
        } else {
          texts.push(foldForMatch(text))
        }
      }
    }
    if (rows.length < READ_BATCH) return texts
    cursor = rows[rows.length - 1].id
  }
}

/** The cached corpus, if it is still fresh: younger than the TTL and one entry per non-draft bill now. */
async function freshCorpus(db: AppDb, tenantKey: string): Promise<string[] | null> {
  const cached = corpora.get(tenantKey)
  if (!cached || Date.now() - cached.loadedAt >= CORPUS_TTL_MS) return null
  // Index-only count (idx_bills_is_draft); reads no bill rows.
  const [{ n }] = await db
    .select({ n: sql<number>`count(*)` })
    .from(bills)
    .where(eq(bills.isDraft, false))
    .all()
  return cached.texts.length === n ? cached.texts : null
}

/**
 * How many bills a keyword list matches, and how that differs from the saved
 * list. Matches on the shared match text and makes no LegiScan or AI calls.
 * `tenantKey` scopes the corpus cache to one instance's database.
 *
 * The baseline for "newly" and "unmatched" is the matcher run over the saved
 * list, not each bill's stored match type: that is the set saving moves from.
 *
 * Keywords outside Latin-1 (a curly quote, a non-Latin script) cannot be
 * matched against the folded cache, so those calls re-read the bills.
 */
export async function summarizeKeywordMatches(
  db: AppDb,
  tenantKey: string,
  proposed: string[],
  saved: string[],
): Promise<KeywordMatchSummary> {
  const next = cleanKeywords(proposed)
  const current = cleanKeywords(saved)
  const t: Tally = {
    next,
    current,
    // Identical lists cannot change any bill, so the second matcher pass is skipped.
    unchanged: next.length === current.length && next.every((k, i) => k === current[i]),
    summary: { total: 0, matched: 0, newlyMatched: 0, unmatched: 0 },
  }

  const cached = await freshCorpus(db, tenantKey)
  if (cached && next.every(isFoldSafe) && current.every(isFoldSafe)) {
    for (const text of cached) tally(t, text)
    return t.summary
  }

  const texts = await readAll(db, t, !cached, tenantKey)
  if (texts) corpora.set(tenantKey, { loadedAt: Date.now(), texts })
  else if (!cached) corpora.delete(tenantKey)
  return t.summary
}
