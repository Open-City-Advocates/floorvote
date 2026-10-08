/** What a draft bill with no title shows wherever a title would render. */
export const UNTITLED_DRAFT_TITLE = 'Untitled draft'

/**
 * The title to SHOW for a bill. The single place the "Untitled draft" fallback
 * lives — every list, page, picker, email, and calendar entry that renders a
 * bill title routes through here rather than testing for a blank title itself.
 *
 * A draft bill may be created (or edited) with no title; its row stores '' and
 * this supplies the label. A filed bill never takes the fallback: its title
 * comes from the data source, so a blank one returns '' and the caller decides
 * what else to show (typically the abstract).
 *
 * Display only. Edit inputs must keep reading the raw title, or saving an
 * untouched field would write the placeholder into the row.
 */
export function billDisplayTitle(bill: { title?: string | null; isDraft?: boolean | null }): string {
  if (bill.title && bill.title.trim()) return bill.title
  return bill.isDraft ? UNTITLED_DRAFT_TITLE : ''
}
