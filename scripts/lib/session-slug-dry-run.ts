import { firstFreeSlug, sessionToSlug, sessionToSlugBeforeProviders } from '../../shared/sessionSlug'

/** A central `sessions` row, as the dry run reads it. */
export interface DryRunSession {
  sessionId: number
  state: string
  sessionName: string
  /** The row's provider. 'legiscan' on a central from before the provider column. */
  provider?: string
  /** The state's owner from state_providers. 'legiscan' when the state has no row. */
  owner?: string
}

/** A session whose slug its name asks for is taken, and the slug it would get. */
export interface DryRunCollision extends DryRunSession {
  wanted: string
  slug: string
}

/**
 * A session the current rule (sessionToSlug) slugs differently from the rule
 * releases before provider-model used (sessionToSlugBeforeProviders), so its
 * bill URLs change. `slug` is the one it would get. `oldSlugHolder` is the
 * session of its state that would hold its old slug, if any: an old link to a
 * number both sessions have reaches that session's bill, with a pointer here.
 */
export interface DryRunRename extends DryRunSession {
  oldSlug: string
  slug: string
  oldSlugHolder?: number
}

/**
 * Read rows from wrangler's `d1 execute --json` output, or from CSV lines of
 * `session_id,state,session_name` (the name is the rest of the line, so it may
 * hold commas). A CSV header line is skipped.
 */
export function parseSessionRows(input: string): DryRunSession[] {
  const text = input.trim()
  if (text.startsWith('[') || text.startsWith('{')) {
    const parsed = JSON.parse(text) as unknown
    const blocks = (Array.isArray(parsed) ? parsed : [parsed]) as { results?: Record<string, unknown>[] }[]
    return blocks.flatMap(b => b.results ?? []).map(r => ({
      sessionId: Number(r.session_id),
      state: String(r.state),
      sessionName: String(r.session_name ?? ''),
      provider: r.provider == null ? undefined : String(r.provider),
      owner: r.owner == null ? undefined : String(r.owner),
    }))
  }
  return text.split(/\r?\n/).filter(Boolean).flatMap(line => {
    const m = /^\s*"?(\d+)"?\s*,\s*"?([^,"]*)"?\s*,(.*)$/.exec(line)
    if (!m) return []
    return [{ sessionId: Number(m[1]), state: m[2].trim(), sessionName: m[3].trim().replace(/^"(.*)"$/, '$1').replace(/""/g, '"') }]
  })
}

/**
 * The slugs central would assign these sessions on its first cron tick after
 * migration 0031 (central/src/lib/sessionSlugs.ts): the owning provider's
 * sessions first, then lowest id, each taking the first free of the slug its
 * name asks for, then "-2", "-3", and so on. Returns the sessions that would
 * not get the slug they ask for (collisions), and the sessions whose name asks
 * for a different slug than the one older releases gave them (renames). Between
 * them, they are every session whose bill URLs change.
 */
export function dryRunSlugs(rows: DryRunSession[]): { collisions: DryRunCollision[]; renames: DryRunRename[] } {
  const owns = (s: DryRunSession) => (s.owner ?? 'legiscan') === (s.provider ?? 'legiscan')
  const ordered = [...rows].sort((a, b) => Number(owns(b)) - Number(owns(a)) || a.sessionId - b.sessionId)
  const taken = new Map<string, Map<string, number>>()
  const assigned: { session: DryRunSession; wanted: string; slug: string }[] = []
  for (const s of ordered) {
    const used = taken.get(s.state) ?? new Map<string, number>()
    taken.set(s.state, used)
    const wanted = sessionToSlug(s.sessionName) || 'session'
    const slug = firstFreeSlug(wanted, new Set(used.keys()))
    used.set(slug, s.sessionId)
    assigned.push({ session: s, wanted, slug })
  }
  const collisions = assigned.filter(a => a.slug !== a.wanted).map(a => ({ ...a.session, wanted: a.wanted, slug: a.slug }))
  const renames = assigned.flatMap(({ session: s, wanted, slug }) => {
    const oldSlug = sessionToSlugBeforeProviders(s.sessionName) || 'session'
    if (oldSlug === wanted) return []
    const oldSlugHolder = taken.get(s.state)!.get(oldSlug)
    return [{ ...s, oldSlug, slug, ...(oldSlugHolder === undefined ? {} : { oldSlugHolder }) }]
  })
  return { collisions, renames }
}
