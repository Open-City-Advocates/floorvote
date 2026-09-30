import { describe, it, expect } from 'vitest'
import {
  parseInstanceHints, serializeInstanceHints, upsertInstanceHint, removeInstanceHint,
} from '../../shared/instanceHint'

describe('instanceHint codec', () => {
  it('round-trips a list', () => {
    const list = [{ host: 'wi.floor.vote', name: 'Wisconsin Clerks' }, { host: 'mi.floor.vote', name: 'Michigan' }]
    expect(parseInstanceHints(serializeInstanceHints(list))).toEqual(list)
  })

  it('returns [] for missing, empty, or garbage input', () => {
    expect(parseInstanceHints(undefined)).toEqual([])
    expect(parseInstanceHints('')).toEqual([])
    expect(parseInstanceHints('not-json')).toEqual([])
    expect(parseInstanceHints('{"h":"x"}')).toEqual([])
  })

  it('drops malformed entries but keeps good ones', () => {
    const raw = JSON.stringify([{ h: 'wi.floor.vote', n: 'WI' }, { h: 5 }, { n: 'no host' }, 'str'])
    expect(parseInstanceHints(raw)).toEqual([{ host: 'wi.floor.vote', name: 'WI' }])
  })

  it('upsert moves an existing host to the front and refreshes its name', () => {
    const list = [{ host: 'a.x.org', name: 'A' }, { host: 'b.x.org', name: 'B' }]
    expect(upsertInstanceHint(list, { host: 'b.x.org', name: 'B2' })).toEqual([
      { host: 'b.x.org', name: 'B2' }, { host: 'a.x.org', name: 'A' },
    ])
  })

  it('upsert caps the list at 20 and truncates names to 80 chars', () => {
    const list = Array.from({ length: 20 }, (_, i) => ({ host: `t${i}.x.org`, name: `T${i}` }))
    const out = upsertInstanceHint(list, { host: 'new.x.org', name: 'N'.repeat(200) })
    expect(out).toHaveLength(20)
    expect(out[0]).toEqual({ host: 'new.x.org', name: 'N'.repeat(80) })
    expect(out.some((h) => h.host === 't19.x.org')).toBe(false)
  })

  it('remove drops only the named host', () => {
    const list = [{ host: 'a.x.org', name: 'A' }, { host: 'b.x.org', name: 'B' }]
    expect(removeInstanceHint(list, 'a.x.org')).toEqual([{ host: 'b.x.org', name: 'B' }])
  })
})
