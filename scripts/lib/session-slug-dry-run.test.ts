import { describe, it, expect } from 'vitest'
import { dryRunSlugs, parseSessionRows } from './session-slug-dry-run'

describe('parseSessionRows', () => {
  it('reads CSV, skipping a header, with commas and quotes in names', () => {
    expect(parseSessionRows('session_id,state,session_name\n2154,RI,2026 Regular Session\n7,"US","Special, Joint ""A"""\n')).toEqual([
      { sessionId: 2154, state: 'RI', sessionName: '2026 Regular Session' },
      { sessionId: 7, state: 'US', sessionName: 'Special, Joint "A"' },
    ])
  })

  it("reads wrangler's d1 execute --json output", () => {
    const json = JSON.stringify([{ results: [{ session_id: 1000000026, state: 'DC', session_name: '2025-2026 Council Period 26', provider: 'lims', owner: 'lims' }], success: true }])
    expect(parseSessionRows(json)).toEqual([{ sessionId: 1000000026, state: 'DC', sessionName: '2025-2026 Council Period 26', provider: 'lims', owner: 'lims' }])
  })
})

describe('dryRunSlugs', () => {
  it('reports the sessions whose slug is taken, and what they would get', () => {
    const rows = parseSessionRows([
      '2200,MD,2026 Regular Session',
      '2201,MD,2026 Special Session',
      '2202,MD,2026 1st Extraordinary Session',
      '2154,RI,2026 Regular Session',
      '2155,RI,2026 1st Special Session',
    ].join('\n'))
    const { collisions, renames } = dryRunSlugs(rows)
    expect(collisions.map(c => [c.sessionId, c.wanted, c.slug])).toEqual([[2201, '2026', '2026-2'], [2202, '2026', '2026-3']])
    // Each asks for what older releases gave it, so none is a rename.
    expect(renames).toEqual([])
  })

  it("gives the owner's session the plain slug, ahead of an older one", () => {
    const { collisions } = dryRunSlugs([
      { sessionId: 2050, state: 'DC', sessionName: '2025-2026 Council Period 26', provider: 'legiscan', owner: 'lims' },
      { sessionId: 1000000026, state: 'DC', sessionName: '2025-2026 Council Period 26', provider: 'lims', owner: 'lims' },
    ])
    expect(collisions.map(c => [c.sessionId, c.slug])).toEqual([[2050, 'cp26-2']])
  })

  // The pre-merge gate: a session the new rule slugs differently from main's
  // rule changes its URLs even with no collision, so the dry run lists it too.
  it('reports the sessions the current rule slugs differently from older releases, and who holds the old slug', () => {
    const rows = parseSessionRows([
      '2200,MD,2026 Regular Session',
      '2210,MD,2026 Special Session 1',
      '2300,VA,2026 Special Session I',
      '2400,DC,2025-2026 Council Period 26',
      '2154,RI,2026 1st Special Session',
    ].join('\n'))
    const { collisions, renames } = dryRunSlugs(rows)
    expect(collisions).toEqual([])
    expect(renames.map(r => [r.state, r.sessionId, r.oldSlug, r.slug, r.oldSlugHolder])).toEqual([
      ['MD', 2210, '2026', '2026-s1', 2200],
      ['VA', 2300, '2026', '2026-s1', undefined],
      ['DC', 2400, '2025-2026', 'cp26', undefined],
    ])
  })

  it('flags renamed sessions that share an old slug, whose old links to a shared number are ambiguous', () => {
    const { renames } = dryRunSlugs(parseSessionRows([
      '2210,MD,2026 Special Session 1',
      '2211,MD,2026 Special Session 2',
      '2300,VA,2026 Special Session I',
    ].join('\n')))
    expect(renames.map(r => [r.sessionId, r.oldSlugHolder, r.sharesOldSlugWith])).toEqual([
      [2210, undefined, [2211]],
      [2211, undefined, [2210]],
      [2300, undefined, undefined],
    ])
  })

  it('lists a renamed session whose new slug is taken in both lists, with the slug it would get', () => {
    const { collisions, renames } = dryRunSlugs([
      { sessionId: 2050, state: 'DC', sessionName: '2025-2026 Council Period 26', provider: 'legiscan', owner: 'lims' },
      { sessionId: 1000000026, state: 'DC', sessionName: '2025-2026 Council Period 26', provider: 'lims', owner: 'lims' },
    ])
    expect(collisions.map(c => c.sessionId)).toEqual([2050])
    expect(renames.map(r => [r.sessionId, r.oldSlug, r.slug])).toEqual([[1000000026, '2025-2026', 'cp26'], [2050, '2025-2026', 'cp26-2']])
  })
})
