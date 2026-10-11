import { describe, it, expect } from 'vitest'
import sessionRaw from '../../fixtures/template/2026-sample.json?raw'
import { inventoryProblems, unfedExtras } from '../../helpers/fieldInventory'
import type { TemplateRecord } from '../../../src/providers/template/client'
import { buildTemplateMeasure, toTemplateEntry } from '../../../src/providers/template/map'
import { inventory } from '../../../src/providers/template/inventory'
import { vocabulary } from '../../../src/providers/template/vocabulary'
import { findProvider } from '../../../src/providers'

// TEMPLATE: the mapping test every provider keeps. It runs the mapping on
// recorded fixtures, with no network and no database: responses saved from
// the live feed (trimmed to a handful of records that cover each case, with
// nothing personal beyond what the legislature publishes), checked against
// the field inventory and the vocabulary. The main-seam test
// (test/cron/template-provider.test.ts) follows the same fixtures through
// central.
const records = JSON.parse(sessionRaw) as TemplateRecord[]
const SESSION = { session_id: 1, session_name: '2026 Session', year_start: 2026, year_end: 2026 }

describe('the template feed', () => {
  it('lists every field of its recorded fixtures in its inventory', () => {
    expect(inventoryProblems(inventory, records, vocabulary)).toEqual([])
  })

  it('feeds every extra its vocabulary declares from some field', () => {
    expect(unfedExtras(vocabulary, inventory)).toEqual([])
  })

  it('maps a record to the full-pass entry', () => {
    expect(toTemplateEntry(records[0], 10, 'h')).toMatchObject({
      bill_id: 10, number: 'HB 1', change_hash: 'h', title: 'Public Library Hours Act',
      status_date: '2026-01-14', state_link: 'https://legislature.example/bills/2026/HB1',
    })
  })

  it('maps a record to the measure central ingests', () => {
    const measure = buildTemplateMeasure(records[1], 11, 'h', SESSION)
    expect(measure).toMatchObject({
      bill_id: 11, bill_number: 'SB 7', state: 'ZZ', session_id: 1, title: 'Road Salt Storage Act',
      history: [{ date: '2026-02-20', action: 'Passed Senate' }],
    })
    expect(Object.keys(measure.extras ?? {}).every(k => k in (vocabulary.extras ?? {}))).toBe(true)
  })

  // TEMPLATE: delete this test in your copy. Your provider belongs in the registry.
  it('stays out of the registry, so central never runs it', () => {
    expect(findProvider('template')).toBeUndefined()
  })

  // TEMPLATE: once the vocabulary lists the feed's statuses and bill types, check
  // that every fixture maps to codes it declares. Once the provider is in the
  // registry, add its codes to "the codes each provider writes" in
  // test/providers/vocabulary.test.ts too.
  it.todo('maps every fixture to a status code and bill type the vocabulary declares')
})
