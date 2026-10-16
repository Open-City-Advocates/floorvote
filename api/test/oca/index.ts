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
