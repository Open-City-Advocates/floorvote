import { sqliteTable, text } from 'drizzle-orm/sqlite-core'
import { sql } from 'drizzle-orm'

/**
 * The fork's own instance tables, which upstream never creates, changes, or
 * reads (docs/internal/fork-upgrade.md). Upstream's tables are in schema.ts.
 */

// Council CRM (migration 0074): the team's record of Councilmembers' offices and
// Council staff, keyed by shared/crmKeys.ts. Kept out of deep analyses for now.
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

