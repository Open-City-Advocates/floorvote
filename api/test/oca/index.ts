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
