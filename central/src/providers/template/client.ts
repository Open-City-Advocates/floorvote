import { rateLimitedFetch } from '../sdk'

/**
 * TEMPLATE: the client for the feed. It knows the feed's URLs and response
 * shapes, and nothing about central's. Replace the base URL, the record type,
 * and the checks below with the feed's own, and say here where the feed is
 * documented and what it publishes.
 *
 * Official feeds only: the legislature's own API or published data files,
 * never scraped HTML. An undocumented endpoint is acceptable only when an
 * error, an unexpected shape, or an empty answer from it changes nothing.
 *
 * This placeholder reads one JSON file per session, every measure in it, as
 * the Maryland provider does (providers/mga/client.ts).
 */
export const TEMPLATE_BASE = 'https://legislature.example/data'

/** Pacing is a courtesy unless the feed sets a limit. Use the feed's limit, below it, when it has one. */
const TEMPLATE_RATE_PER_SEC = 1

/** One record of a session file, as the feed sends it. Every field is listed in inventory.ts. */
export interface TemplateRecord {
  /** The measure number, as the legislature prints it: "HB 1". */
  Number: string
  Title: string
  /** The feed's own name for the measure's status. */
  Status: string
  /** YYYY-MM-DD. */
  StatusDate: string
  /** The measure's page on the legislature's site. */
  Url: string
}

function sessionUrl(sessionCode: string): string {
  return `${TEMPLATE_BASE}/${sessionCode}/bills.json`
}

/**
 * Every record of one session, or null when the session has no file yet.
 *
 * Fails closed: an HTTP error, a body that isn't JSON, or a record whose shape
 * isn't what the mapping reads throws, so the sync stops for the hour without
 * writing anything from that answer. An empty list comes back empty, and the
 * sync reads it as nothing new, never as measures removed.
 */
export async function getTemplateSession(sessionCode: string, onRequest?: () => void): Promise<TemplateRecord[] | null> {
  const res = await rateLimitedFetch(sessionUrl(sessionCode), { headers: { Accept: 'application/json' } },
    { ratePerSec: TEMPLATE_RATE_PER_SEC, bucketKey: 'template', onRequest })
  if (res.status === 404) return null
  if (!res.ok) throw new Error(`Template HTTP ${res.status} for ${sessionCode}`)
  let data: unknown
  try {
    data = JSON.parse(await res.text())
  } catch {
    throw new Error(`Template ${sessionCode}: the session file isn't JSON`)
  }
  if (!Array.isArray(data)) throw unexpected(sessionCode, 'not a list')
  for (const record of data) checkRecord(sessionCode, record)
  return data as TemplateRecord[]
}

/** Whether a session's file exists yet. */
export async function templateSessionExists(sessionCode: string, onRequest?: () => void): Promise<boolean> {
  const res = await rateLimitedFetch(sessionUrl(sessionCode), { method: 'HEAD' },
    { ratePerSec: TEMPLATE_RATE_PER_SEC, bucketKey: 'template', onRequest })
  if (res.status === 404) return false
  if (!res.ok) throw new Error(`Template HTTP ${res.status} for ${sessionCode}`)
  return true
}

function unexpected(sessionCode: string, what: string): Error {
  return new Error(`Template ${sessionCode}: unexpected session file (${what})`)
}

// Every key the mapping reads. Each must be present: a missing key isn't read
// as an empty one, or a key the feed renamed would quietly strip that field
// from every measure on its next ingest.
const TEXT_KEYS = ['Number', 'Title', 'Status', 'StatusDate', 'Url'] as const

function checkRecord(sessionCode: string, record: unknown): void {
  if (typeof record !== 'object' || record === null || Array.isArray(record)) throw unexpected(sessionCode, 'a record that isn\'t an object')
  const r = record as Record<string, unknown>
  for (const key of TEXT_KEYS) {
    if (typeof r[key] !== 'string') throw unexpected(sessionCode, `${key} isn't text`)
  }
  if (!(r.Number as string).trim()) throw unexpected(sessionCode, 'a record without its number')
}
