import type { FieldInventory } from '../sdk'

/**
 * TEMPLATE: every field of a session file's records (`TemplateRecord` in
 * client.ts), and what the provider does with it: `'mapped'` into central's
 * shapes, `{ extra: key }` shown as an extra the vocabulary declares, or
 * `{ ignored: reason }`. Paths are dotted, with `[]` for an array's items
 * (`Sponsors[].Name`), and an ignored object or array covers everything in it.
 *
 * Reviewers read this to see that nothing in the feed is dropped silently,
 * and the mapping test (central/test/providers/template/map.test.ts) fails on
 * any field in the recorded fixtures that isn't listed here. Keep one
 * inventory for each response the provider reads (a listing and a
 * per-measure details response, say).
 */
export const inventory: FieldInventory = {
  Number: 'mapped',
  Title: 'mapped',
  Status: 'mapped',
  StatusDate: 'mapped',
  Url: 'mapped',
}
