import { sqliteTable, text, integer, index, uniqueIndex } from 'drizzle-orm/sqlite-core'
import { sql } from 'drizzle-orm'

/**
 * The fork's own instance tables, which upstream never creates, changes, or
 * reads (docs/internal/fork-upgrade.md). Upstream's tables are in schema.ts.
 */

// Council CRM (migration 0074): the team's record of Councilmembers' offices and
// Council staff, keyed by shared/oca/crmKeys.ts. Kept out of deep analyses for now.
export const crmPeople = sqliteTable('crm_people', {
  personKey: text('person_key').primaryKey(),
  name: text('name').notNull(),
  office: text('office'),
  ownerId: text('owner_id'),
  stance: text('stance'),
  updatedBy: text('updated_by'),
  updatedAt: text('updated_at').notNull().default(sql`(datetime('now'))`),
})

export const crmContacts = sqliteTable('crm_contacts', {
  id: text('id').primaryKey(),
  personKey: text('person_key').notNull(),
  contactDate: text('contact_date').notNull(),
  kind: text('kind', { enum: ['meeting', 'call', 'email', 'testimony', 'event', 'other'] }).notNull(),
  summary: text('summary').notNull(),
  billId: text('bill_id'),
  authorId: text('author_id'),
  createdAt: text('created_at').notNull().default(sql`(datetime('now'))`),
  updatedAt: text('updated_at'),
})

export const crmFollowups = sqliteTable('crm_followups', {
  id: text('id').primaryKey(),
  personKey: text('person_key').notNull(),
  dueDate: text('due_date'),
  text: text('text').notNull(),
  ownerId: text('owner_id'),
  doneAt: text('done_at'),
  doneBy: text('done_by'),
  authorId: text('author_id'),
  createdAt: text('created_at').notNull().default(sql`(datetime('now'))`),
})

// Deep analyses and hearing briefs, filled by an external worker (migration 0071).
export const deepAnalyses = sqliteTable('deep_analyses', {
  id: text('id').primaryKey(),
  kind: text('kind', { enum: ['bill', 'hearing'] }).notNull(),
  subjectId: text('subject_id').notNull(),
  status: text('status', { enum: ['pending', 'claimed', 'done', 'error'] }).notNull().default('pending'),
  inputHash: text('input_hash').notNull(),
  requestedBy: text('requested_by'),
  requestedAt: text('requested_at').notNull().default(sql`(datetime('now'))`),
  claimedAt: text('claimed_at'),
  claimedBy: text('claimed_by'),
  content: text('content'),
  contentInputHash: text('content_input_hash'),
  model: text('model'),
  completedAt: text('completed_at'),
  error: text('error'),
  attempts: integer('attempts').notNull().default(0),
}, (t) => [uniqueIndex('deep_analyses_kind_subject').on(t.kind, t.subjectId)])

// A team's links to its own documents, on a bill or a calendar event (migration 0072).
export const teamLinks = sqliteTable('team_links', {
  id: text('id').primaryKey(),
  subjectKind: text('subject_kind', { enum: ['bill', 'event'] }).notNull(),
  subjectId: text('subject_id').notNull(),
  title: text('title').notNull(),
  url: text('url').notNull(),
  addedBy: text('added_by'),
  addedAt: text('added_at').notNull().default(sql`(datetime('now'))`),
}, (t) => [index('idx_team_links_subject').on(t.subjectKind, t.subjectId)])

