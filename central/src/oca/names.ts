/**
 * Name handling for DC Councilmembers, as LIMS and dccouncil.gov write them.
 * The fork's own copy: upstream's LIMS provider has the same helpers, but core
 * code may not import a provider's internals (central/eslint-provider-boundary.mjs).
 */

export interface LimsPerson { peopleId: number; name: string; role: string }

/** Trim and collapse whitespace; LIMS text carries trailing and doubled spaces. */
export function clean(s: string | null | undefined): string {
  return (s ?? '').replace(/\s+/g, ' ').trim()
}

/** "2025-01-02T00:00:00" → "2025-01-02". */
export function limsDate(s: string | null | undefined): string | null {
  const m = /^(\d{4}-\d{2}-\d{2})/.exec(s ?? '')
  return m ? m[1] : null
}

const SUFFIX_RE = /,?\s+(Jr|Sr|II|III|IV)\.?(?=,|$)/i

/**
 * Comparable key for a Councilmember name as LIMS writes it on different
 * surfaces: "Parker, Zachary", "Zachary Parker ", "Robert C. White, Jr.",
 * "White, Robert C. Jr.". Generational suffixes are dropped, and a
 * "Last, First" name is turned around.
 */
export function personKey(name: string): string {
  const n = clean(name).replace(/^(Councilmember|Chairman|Chairperson|Chair)\s+/i, '').replace(SUFFIX_RE, '')
  const comma = n.indexOf(',')
  const full = comma >= 0 ? `${n.slice(comma + 1)} ${n.slice(0, comma)}` : n
  return full.toLowerCase().replace(/[^a-z ]/g, '').replace(/\s+/g, ' ').trim()
}

/** personKey without middle names or initials: "robert c white" → "robert white". */
export function personShortKey(name: string): string {
  const parts = personKey(name).split(' ')
  return parts.length > 2 ? `${parts[0]} ${parts[parts.length - 1]}` : parts.join(' ')
}

/**
 * Index Councilmembers under both keys. A short key shared by two people is
 * left out rather than guessed.
 */
export function indexPeople(list: LimsPerson[]): Map<string, LimsPerson> {
  const map = new Map<string, LimsPerson>()
  const shortCount = new Map<string, number>()
  for (const p of list) shortCount.set(personShortKey(p.name), (shortCount.get(personShortKey(p.name)) ?? 0) + 1)
  for (const p of list) {
    map.set(personKey(p.name), p)
    const short = personShortKey(p.name)
    if (shortCount.get(short) === 1 && !map.has(short)) map.set(short, p)
  }
  return map
}

export function findPerson(people: Map<string, LimsPerson>, name: string): LimsPerson | undefined {
  return people.get(personKey(name)) ?? people.get(personShortKey(name))
}
