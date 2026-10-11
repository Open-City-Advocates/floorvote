import { sqliteTable, text, integer, primaryKey } from 'drizzle-orm/sqlite-core'
import { sql } from 'drizzle-orm'

/**
 * The fork's own central tables (migrations 0022–0024), which upstream never
 * creates, changes, or reads. See docs/internal/fork-upgrade.md.
 */

/** dccouncil.gov's committees, with roster, staff, and agencies (migration 0022). */
export const councilCommittees = sqliteTable('council_committees', {
  slug:         text('slug').primaryKey(),
  name:         text('name').notNull(),
  url:          text('url').notNull(),
  chairJson:    text('chair_json'),
  membersJson:  text('members_json').notNull().default('[]'),
  staffJson:    text('staff_json').notNull().default('[]'),
  agenciesJson: text('agencies_json').notNull().default('[]'),
  updatedAt:    text('updated_at').notNull().default(sql`(datetime('now'))`),
})

/** The Council directory: every staffer and Councilmember with title, office, and contacts (migration 0022). */
export const councilDirectory = sqliteTable('council_directory', {
  entryKey:  text('entry_key').primaryKey(),
  kind:      text('kind').notNull(),
  name:      text('name').notNull(),
  title:     text('title'),
  office:    text('office'),
  email:     text('email'),
  phone:     text('phone'),
  updatedAt: text('updated_at').notNull().default(sql`(datetime('now'))`),
})

/** Each version of a committee's roster (migration 0023). The open row has validTo null. */
export const councilCommitteeHistory = sqliteTable('council_committee_history', {
  slug:        text('slug').notNull(),
  validFrom:   text('valid_from').notNull(),
  validTo:     text('valid_to'),
  name:        text('name').notNull(),
  chair:       text('chair'),
  membersJson: text('members_json').notNull().default('[]'),
  staffJson:   text('staff_json').notNull().default('[]'),
}, (t) => [primaryKey({ columns: [t.slug, t.validFrom] })])

/** Council changes, newest last: seats, chairs, memberships, key staff, committees (migration 0023). */
export const councilChanges = sqliteTable('council_changes', {
  id:         integer('id').primaryKey({ autoIncrement: true }),
  detectedAt: text('detected_at').notNull().default(sql`(datetime('now'))`),
  kind:       text('kind').notNull(),
  committee:  text('committee'),
  person:     text('person'),
  detail:     text('detail'),
})

/**
 * The fork's view of upstream's `people`: the columns it reads, plus the term
 * and seat columns it added (migrations 0023 and 0024). It writes only those.
 */
export const councilPeople = sqliteTable('people', {
  peopleId:  integer('people_id').primaryKey(),
  name:      text('name').notNull(),
  role:      text('role'),
  provider:  text('provider').notNull(),
  // LIMS term dates. A member whose termEnd has passed is former.
  termStart: text('term_start'),
  termEnd:   text('term_end'),
  // Whether dccouncil.gov's Councilmembers page listed the member at the last sync.
  seated:    integer('seated'),
})
