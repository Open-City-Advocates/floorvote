import { and, eq, inArray, isNull, notInArray } from 'drizzle-orm'
import type { BatchItem } from 'drizzle-orm/batch'
import { sessions } from '../db/schema'
import { rateLimitedFetch } from '../lib/rateLimitedFetch'
import { getCurrentEtHour } from '../lib/sync-schedule'
import { nowDb } from '../lib/dbTime'
import { councilChanges, councilCommitteeHistory, councilCommittees, councilDirectory, councilPeople } from './schema'
import { diffCommittees, diffTerms, isCurrentMember, linkCommittees, periodMembers, reconcileSeated, rosterSignature, type MemberTerm } from './council-changes'
import { fetchCommittees, fetchCouncilmembers, fetchDirectory } from './dccouncil-directory'
import { clean, limsDate } from './names'
import type { Db, Env } from '../types'

/**
 * The fork's DC Council directory and membership history: committees, staff,
 * who is seated, and LIMS term dates, with a log of what changed. Upstream's
 * LIMS provider writes DC's bills and people; this writes only the fork's own
 * tables (schema.ts) and the term and seat columns it added to `people`.
 *
 * It ran inside the old LIMS sync. It now runs as a job of its own, daily at
 * 5 ET (or now, from the admin route), once LIMS owns DC.
 */

const LIMS_BASE = 'https://lims.dccouncil.gov/api/v2/PublicData/'
const LIMS_ID_BASE = 1_000_000_000
const DIRECTORY_HOUR_ET = 5

export interface DirectoryReport { periods: number; committees: number; people: number }

export async function runDcDirectory(env: Env, db: Db, opts: { force?: boolean } = {}): Promise<DirectoryReport | null> {
  if (!env.LIMS_API_KEY) return null
  if (!opts.force && getCurrentEtHour() !== DIRECTORY_HOUR_ET) return null
  const today = nowDb().slice(0, 10)
  const periods = await refreshTerms(env.LIMS_API_KEY, db, today)
  if (periods === 0) return null  // LIMS doesn't hold DC here yet
  const d = await syncCouncilDirectory(db)
  return { periods, ...d }
}

interface LimsCouncilMember { id: number; name: string; startDate: string | null; endDate: string | null }

async function getMembers(councilPeriodId: number, apiKey: string): Promise<LimsCouncilMember[]> {
  const res = await rateLimitedFetch(`${LIMS_BASE}Members/${councilPeriodId}`, {
    headers: { Authorization: `Bearer ${apiKey}`, Accept: 'application/json' },
  }, { ratePerSec: 1, bucketKey: 'lims' })
  if (!res.ok) throw new Error(`LIMS HTTP ${res.status} for Members/${councilPeriodId}`)
  const data = await res.json() as unknown
  if (!Array.isArray(data)) throw new Error(`LIMS Members/${councilPeriodId}: not a list`)
  return data as LimsCouncilMember[]
}

/**
 * Write each LIMS Council Period's members' term dates, and log seat changes in
 * the current one. Only `term_start` and `term_end` are written, on the rows
 * upstream's LIMS provider keeps (`people_id` is LIMS's packed id); a member it
 * hasn't written yet gets terms on a later run. Returns how many periods it read.
 */
export async function refreshTerms(apiKey: string, db: Db, today: string): Promise<number> {
  const rows = await db.select({ sessionId: sessions.sessionId, prior: sessions.prior }).from(sessions)
    .where(and(eq(sessions.state, 'DC'), eq(sessions.provider, 'lims'))).all()
  if (rows.length === 0) return 0
  const current = rows.find(r => r.prior === 0) ?? rows.reduce((a, b) => (b.sessionId > a.sessionId ? b : a))
  // Earlier periods first, the current one last, so its record wins where a member repeats.
  const ordered = [...rows.filter(r => r !== current).sort((a, b) => a.sessionId - b.sessionId), current]

  // Terms as stored before this refresh. No terms yet means this is the first
  // run with term dates: a baseline, not a Council of newcomers.
  const stored = await db.select({ peopleId: councilPeople.peopleId, name: councilPeople.name, termStart: councilPeople.termStart, termEnd: councilPeople.termEnd })
    .from(councilPeople).where(eq(councilPeople.provider, 'lims')).all()
  const baseline = stored.some(p => p.termEnd !== null) ? new Map(stored.map(p => [p.peopleId, p])) : null

  let currentTerms: MemberTerm[] = []
  for (const period of ordered) {
    const members = await getMembers(period.sessionId - LIMS_ID_BASE, apiKey)
    const terms = members.map(m => ({ peopleId: LIMS_ID_BASE + m.id, name: clean(m.name), termStart: limsDate(m.startDate), termEnd: limsDate(m.endDate) }))
    const writes: BatchItem<'sqlite'>[] = terms.map(t => db.update(councilPeople)
      .set({ termStart: t.termStart, termEnd: t.termEnd })
      .where(and(eq(councilPeople.peopleId, t.peopleId), eq(councilPeople.provider, 'lims'))))
    if (writes.length > 0) await db.batch(writes as [BatchItem<'sqlite'>, ...BatchItem<'sqlite'>[]])
    if (period === current) currentTerms = terms
  }

  // Seat changes are the current Council's: an earlier period's members
  // appearing for the first time are history, not new members.
  const changes = diffTerms(baseline, currentTerms, today)
  if (changes.length > 0) await db.insert(councilChanges).values(changes)
  return ordered.length
}

export async function syncCouncilDirectory(db: Db): Promise<{ committees: number; people: number }> {
  const now = nowDb()
  // Who is sitting, from the Council's page, before rosters are linked to it.
  // A failure keeps the stored status; the committees and directory still sync.
  try {
    await syncSeated(db, now)
  } catch (err) {
    console.warn('[dc-directory] Councilmembers page skipped:', err)
  }
  let committeeCount = 0
  let committeeError: unknown = null
  try {
    const { committees: fetched, currentSlugs } = await fetchCommittees()
    committeeCount = fetched.length
    if (currentSlugs.length >= 5 && fetched.length >= 5) {
      const today = now.slice(0, 10)
      // Link rosters to the Council as it stands today, so a roster, a vote,
      // and a term refer to the same person.
      const sitting = (await db.select({ peopleId: councilPeople.peopleId, name: councilPeople.name, role: councilPeople.role, termStart: councilPeople.termStart, termEnd: councilPeople.termEnd, seated: councilPeople.seated })
        .from(councilPeople).where(eq(councilPeople.provider, 'lims')).all())
        .filter(p => isCurrentMember(p, today))
        .map(p => ({ peopleId: p.peopleId, name: p.name, role: p.role ?? 'Councilmember' }))
      const committees = linkCommittees(fetched, sitting)

      const parse = <T>(v: string | null, fallback: T): T => { if (!v) return fallback; try { return JSON.parse(v) as T } catch { return fallback } }
      const storedRows = await db.select().from(councilCommittees).all()
      const before = new Map(storedRows.map(r => [r.slug, {
        name: r.name, chair: parse<{ name: string } | null>(r.chairJson, null),
        members: parse<{ name: string }[]>(r.membersJson, []), staff: parse<{ name: string; title: string | null }[]>(r.staffJson, []),
      }]))
      const after = new Map(committees.map(c => [c.slug, c]))
      const removedSlugs = storedRows.map(r => r.slug).filter(slug => !currentSlugs.includes(slug))
      // The first directory sync sets a baseline: no stored rows, no "changes".
      const changes = storedRows.length > 0 ? diffCommittees(before, after, removedSlugs) : []

      const openRows = new Map((await db.select().from(councilCommitteeHistory).where(isNull(councilCommitteeHistory.validTo)).all()).map(r => [r.slug, r]))
      const writes: BatchItem<'sqlite'>[] = [db.delete(councilCommittees).where(notInArray(councilCommittees.slug, currentSlugs))]
      for (const c of committees) {
        const values = {
          slug: c.slug, name: c.name, url: c.url,
          chairJson: c.chair ? JSON.stringify(c.chair) : null,
          membersJson: JSON.stringify(c.members), staffJson: JSON.stringify(c.staff), agenciesJson: JSON.stringify(c.agencies),
          updatedAt: now,
        }
        const { slug: _s, ...update } = values
        writes.push(db.insert(councilCommittees).values(values).onConflictDoUpdate({ target: councilCommittees.slug, set: update }))
        const open = openRows.get(c.slug)
        const openRoster = open && { name: open.name, chair: open.chair ? { name: open.chair } : null, members: parse<{ name: string }[]>(open.membersJson, []), staff: parse<{ name: string; title: string | null }[]>(open.staffJson, []) }
        if (!openRoster || rosterSignature(openRoster) !== rosterSignature(c)) {
          if (open) writes.push(db.update(councilCommitteeHistory).set({ validTo: now }).where(and(eq(councilCommitteeHistory.slug, c.slug), eq(councilCommitteeHistory.validFrom, open.validFrom))))
          writes.push(db.insert(councilCommitteeHistory).values({
            slug: c.slug, validFrom: now, name: c.name, chair: c.chair?.name ?? null,
            membersJson: JSON.stringify(c.members.map(m => ({ name: m.name, peopleId: m.peopleId }))),
            staffJson: JSON.stringify(c.staff.map(st => ({ name: st.name, title: st.title }))),
          }).onConflictDoNothing())
        }
      }
      for (const slug of removedSlugs) {
        const open = openRows.get(slug)
        if (open) writes.push(db.update(councilCommitteeHistory).set({ validTo: now }).where(and(eq(councilCommitteeHistory.slug, slug), eq(councilCommitteeHistory.validFrom, open.validFrom))))
      }
      if (changes.length > 0) writes.push(db.insert(councilChanges).values(changes.map(ch => ({ ...ch, detectedAt: now }))))
      await db.batch(writes as [BatchItem<'sqlite'>, ...BatchItem<'sqlite'>[]])
    }
  } catch (err) {
    committeeError = err
  }

  const directoryEntries = await fetchDirectory()
  const rows = new Map<string, typeof councilDirectory.$inferInsert>()
  for (const p of directoryEntries) {
    // Staff can share an office mailbox, so the name is part of the key.
    const entryKey = `${p.email ?? ''}|${p.name}|${p.office ?? ''}`.toLowerCase()
    rows.set(entryKey, { entryKey, kind: p.kind, name: p.name, title: p.title, office: p.office, email: p.email, phone: p.phone, updatedAt: now })
  }
  if (rows.size >= 50) {
    const all = [...rows.values()]
    const writes: BatchItem<'sqlite'>[] = [db.delete(councilDirectory)]
    for (let i = 0; i < all.length; i += 10) writes.push(db.insert(councilDirectory).values(all.slice(i, i + 10)))
    await db.batch(writes as [BatchItem<'sqlite'>, ...BatchItem<'sqlite'>[]])
  }
  if (committeeError) throw committeeError
  return { committees: committeeCount, people: rows.size }
}

/**
 * Mark each LIMS member seated or not from dccouncil.gov's Councilmembers
 * page. Names link to the current Council Period's records only, so a member
 * of two periods (who has two LIMS ids) links to the current one.
 */
async function syncSeated(db: Db, now: string): Promise<void> {
  const listed = await fetchCouncilmembers()
  const today = now.slice(0, 10)
  const period = await db.select({ yearStart: sessions.yearStart }).from(sessions)
    .where(and(eq(sessions.state, 'DC'), eq(sessions.provider, 'lims'), eq(sessions.prior, 0))).get()
  const all = await db.select({ peopleId: councilPeople.peopleId, name: councilPeople.name, termStart: councilPeople.termStart, termEnd: councilPeople.termEnd, seated: councilPeople.seated })
    .from(councilPeople).where(eq(councilPeople.provider, 'lims')).all()
  const members = periodMembers(all, period?.yearStart ?? null)
  const r = reconcileSeated(listed, members, today)
  if (!r) {
    console.warn(`[dc-directory] Councilmembers page linked too few names (${listed.length} listed); status kept`)
    return
  }
  if (r.unlinked.length > 0) console.warn(`[dc-directory] Councilmembers not in LIMS: ${r.unlinked.join('; ')}`)
  const writes: BatchItem<'sqlite'>[] = [
    db.update(councilPeople).set({ seated: 0 }).where(eq(councilPeople.provider, 'lims')),
    db.update(councilPeople).set({ seated: 1 }).where(inArray(councilPeople.peopleId, [...r.seatedIds])),
  ]
  if (r.changes.length > 0) writes.push(db.insert(councilChanges).values(r.changes.map(ch => ({ ...ch, detectedAt: now }))))
  await db.batch(writes as [BatchItem<'sqlite'>, ...BatchItem<'sqlite'>[]])
}
