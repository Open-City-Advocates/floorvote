import { DCYJ_BILLS } from '../../src/oca/demoSeeds/dcYouthJustice/bills'

// OCA's hooks into upstream's api test files, each used from one line there
// (docs/internal/fork-upgrade.md, "Keep Fork Features Separate").

/** The fork's write routes a demo tenant refuses, for test/routes/demoReadOnly.test.ts. */
export const OCA_DEMO_DENIED = [
  // The deep-analysis queue is off on demo tenants and would hand work to an operator's worker.
  'POST /api/deep/:kind/:subjectId/request',
  'POST /api/deep/worker/requests/:id/claim',
  'POST /api/deep/worker/requests/:id/release',
  'POST /api/deep/worker/requests/:id/result',
  // Team links point at a team's own documents.
  'POST /api/links/:kind/:subjectId',
  'DELETE /api/links/:id',
  // The Council CRM: a team's notes on real Council offices and staff, not demo material.
  'PUT /api/crm/people/:key',
  'POST /api/crm/people/:key/contacts',
  'PATCH /api/crm/contacts/:id',
  'DELETE /api/crm/contacts/:id',
  'POST /api/crm/people/:key/followups',
  'PATCH /api/crm/followups/:id',
  'DELETE /api/crm/followups/:id',
]

/**
 * Calendar offsets for OCA's demo seeds, pinned as literals, for
 * test/lib/dateFromNow.test.ts's EXPECTED_OFFSETS. Changing a seed offset must
 * change this table too. The hearings are real Council events, each at its real
 * date's distance from 2026-10-16.
 */
export const OCA_DEMO_EXPECTED_OFFSETS: Record<string, Record<string, number>> = {
  'dc-youth-justice': {
    'dcyj-hearing-1': 11, 'dcyj-hearing-2': 11,
    'dcyj-hearing-past-1': -23, 'dcyj-hearing-past-2': -9,
    'dcyj-council-1': 20, 'dcyj-council-2': 25, 'dcyj-council-3': 27, 'dcyj-council-past-1': -10,
    'dcyj-event-1': 4, 'dcyj-event-2': 6, 'dcyj-event-3': 18,
    'dcyj-event-past-1': -12, 'dcyj-event-past-2': -31,
  },
}

/**
 * OCA's demo seeds for test/lib/demoSeeds.savedViews.test.ts's CASES. Each bill
 * carries the tags OCA's analysis gave it on 2026-10-16, which the demo copies at
 * standup; the seed writes the priorities, positions, and Lead Committee values.
 */
const DCYJ_TAGS: Record<string, string[]> = {
  'HN26-0083': ['Juvenile Justice', 'DYRS', 'Conditions of Confinement', 'Oversight & Nominations'],
  'HN26-0163': ['Juvenile Justice', 'DYRS', 'Oversight & Nominations'],
  'B26-0286': ['Juvenile Justice', 'Policing'],
  'B26-0355': ['Juvenile Justice', 'Policing'],
  'B26-0404': ['DYRS', 'Conditions of Confinement', 'Behavioral Health'],
  'B26-0526': ['Conditions of Confinement', 'Education & Truancy', 'Youth Charged as Adults', 'Juvenile Justice'],
  'B26-0671': ['Pretrial & Detention', 'Sentencing'],
  'B26-0188': ['Pretrial & Detention', 'Youth Charged as Adults'],
  'B26-0479': ['Juvenile Justice', 'Child Welfare', 'Reentry & Records'],
  'PR26-0764': ['Education & Truancy', 'Conditions of Confinement'],
  'HN26-0088': ['Behavioral Health', 'Oversight & Nominations'],
  'B26-0461': ['Juvenile Justice', 'Policing'],
  'B26-0636': ['Juvenile Justice', 'Policing'],
  'B26-0186': ['Juvenile Justice', 'Pretrial & Detention', 'Education & Truancy', 'Behavioral Health'],
  'B26-0413': ['Juvenile Justice', 'DYRS', 'Budget & Reprogramming'],
  'B26-0038': ['Reentry & Records'],
  'B26-0401': ['Juvenile Justice', 'DYRS', 'Child Welfare', 'Oversight & Nominations'],
  'B26-0402': ['Juvenile Justice', 'Education & Truancy', 'Child Welfare'],
  'REPROG26-0153': ['DYRS', 'Budget & Reprogramming', 'Conditions of Confinement'],
  'B26-0835': ['Policing', 'Pretrial & Detention', 'Violence Prevention'],
}

export const OCA_SAVED_VIEW_CASES = [
  {
    slug: 'dc-youth-justice',
    fixtures: DCYJ_BILLS.map(b => ({ externalId: b.externalId, state: 'DC', tags: DCYJ_TAGS[b.number] })),
    expectedTotals: {
      'dyrs-detention-or-youth-affairs': 11, 'amend-or-oppose-high-or-medium': 6, 'high-priority-no-position': 2,
    },
  },
]
