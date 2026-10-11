import { describe, it, expect } from 'vitest'
import {
  COUNCIL_CALENDAR_TOPIC, EMPTY_EVENT_RULES, eventMatchesRules, parseEventRules, rulesFromCouncilCalendar,
  type EventFacets, type EventRules,
} from './eventRules'

const youth = { committeeId: '9001', name: 'Committee on Youth Affairs' }
const health = { committeeId: '9002', name: 'Committee on Health' }
const cow = { committeeId: '9003', name: 'Committee of the Whole' }

const event = (over: Partial<EventFacets> = {}): EventFacets => ({
  committeeId: youth.committeeId, committee: youth.name, jointWith: null,
  kind: 'hearing', type: 'Roundtable', title: 'Youth Affairs roundtable',
  topics: ['DYRS\' Fifth Rulemaking on Secure Detention'], ...over,
})
const rules = (over: Partial<EventRules>): EventRules => ({ ...EMPTY_EVENT_RULES, ...over })
const NONE = { tracked: false, prioritized: false }
const TRACKED = { tracked: true, prioritized: false }
const PRIORITIZED = { tracked: true, prioritized: true }

describe('eventMatchesRules', () => {
  it('selects nothing with empty rules', () => {
    expect(eventMatchesRules(event(), EMPTY_EVENT_RULES, TRACKED)).toBe(false)
  })

  it('selects a committee\'s events, and those it holds jointly', () => {
    const r = rules({ committees: [health] })
    expect(eventMatchesRules(event({ committeeId: health.committeeId }), r, NONE)).toBe(true)
    expect(eventMatchesRules(event({ jointWith: 'Joint with Human Services and Health' }), r, NONE)).toBe(true)
    expect(eventMatchesRules(event(), r, NONE)).toBe(false)
  })

  it('narrows a committee to one kind or event type', () => {
    const meetings = rules({ committees: [{ ...cow, kind: 'Meeting' }] })
    expect(eventMatchesRules(event({ committeeId: cow.committeeId, kind: 'meeting', type: 'Meeting' }), meetings, NONE)).toBe(true)
    expect(eventMatchesRules(event({ committeeId: cow.committeeId, kind: 'hearing', type: 'Hearing' }), meetings, NONE)).toBe(false)
    const markups = rules({ committees: [{ ...cow, kind: 'markup' }] })
    expect(eventMatchesRules(event({ committeeId: cow.committeeId, kind: 'markup', type: 'Mark-up' }), markups, NONE)).toBe(true)
  })

  it('selects a kind or an event type in any committee', () => {
    expect(eventMatchesRules(event(), rules({ kinds: ['hearing'] }), NONE)).toBe(true)
    expect(eventMatchesRules(event(), rules({ kinds: ['Roundtable'] }), NONE)).toBe(true)
    expect(eventMatchesRules(event(), rules({ kinds: ['Budget Oversight Hearing'] }), NONE)).toBe(false)
  })

  it('matches a topic\'s keywords against the title and the agenda', () => {
    expect(eventMatchesRules(event(), rules({ topics: [{ name: 'Youth', keywords: ['dyrs'] }] }), NONE)).toBe(true)
    expect(eventMatchesRules(event({ committeeId: null, title: 'Legislative Meeting', topics: [] }),
      rules({ topics: [{ name: 'Council', keywords: ['legislative meeting'] }] }), NONE)).toBe(true)
    expect(eventMatchesRules(event(), rules({ topics: [{ name: 'Housing', keywords: ['housing*'] }] }), NONE)).toBe(false)
  })

  it('never hides an event with a prioritized bill on its agenda', () => {
    expect(eventMatchesRules(event(), EMPTY_EVENT_RULES, PRIORITIZED)).toBe(true)
    expect(eventMatchesRules(event(), rules({ committees: [health] }), PRIORITIZED)).toBe(true)
  })

  it('compares event types without regard to case, and kinds exactly', () => {
    expect(eventMatchesRules(event(), rules({ kinds: ['roundtable'] }), NONE)).toBe(true)
    expect(eventMatchesRules(event(), rules({ committees: [{ ...youth, kind: 'ROUNDTABLE' }] }), NONE)).toBe(true)
    expect(eventMatchesRules(event(), rules({ kinds: ['Hearing'] }), NONE)).toBe(false)
  })

  it('selects an event with a tracked bill on its agenda only when the rule says so', () => {
    expect(eventMatchesRules(event(), rules({ trackedBills: true }), TRACKED)).toBe(true)
    expect(eventMatchesRules(event(), rules({ trackedBills: true }), NONE)).toBe(false)
    expect(eventMatchesRules(event(), rules({ trackedBills: false }), TRACKED)).toBe(false)
  })
})

describe('parseEventRules', () => {
  it('cleans and keeps valid rules', () => {
    expect(parseEventRules({
      committees: [{ committeeId: ' 9001 ', name: 'Committee on Youth Affairs', kind: '' }, { ...cow, kind: 'Meeting' }],
      kinds: ['Roundtable', 'Roundtable', ' markup '],
      topics: [{ name: 'Youth', keywords: ['dyrs', 'juvenile*'] }],
      trackedBills: true,
    })).toEqual({
      committees: [youth, { ...cow, kind: 'Meeting' }],
      kinds: ['Roundtable', 'markup'],
      topics: [{ name: 'Youth', keywords: ['dyrs', 'juvenile*'] }],
      trackedBills: true,
    })
    expect(parseEventRules({})).toEqual(EMPTY_EVENT_RULES)
  })

  it('refuses malformed rules', () => {
    expect(parseEventRules(null)).toBeTypeOf('string')
    expect(parseEventRules([])).toBeTypeOf('string')
    expect(parseEventRules({ committees: [{ committeeId: '1' }] })).toBeTypeOf('string')
    expect(parseEventRules({ committees: [youth, youth] })).toBeTypeOf('string')
    expect(parseEventRules({ kinds: [''] })).toBeTypeOf('string')
    expect(parseEventRules({ kinds: 'hearing' })).toBeTypeOf('string')
    expect(parseEventRules({ topics: [{ name: 'Empty', keywords: [] }] })).toBeTypeOf('string')
    expect(parseEventRules({ topics: [{ keywords: ['x'] }] })).toBeTypeOf('string')
    expect(parseEventRules({ trackedBills: 'yes' })).toBeTypeOf('string')
    expect(parseEventRules({ kinds: Array.from({ length: 201 }, (_, i) => `k${i}`) })).toBeTypeOf('string')
  })
})

describe('rulesFromCouncilCalendar', () => {
  const committees = [youth, health, cow]

  it('carries a fork team\'s DC Council calendar rules over', () => {
    expect(rulesFromCouncilCalendar({
      include: [
        { committee: 'Youth Affairs' }, { committee: 'Legislative Meeting' },
        { committee: 'Committee of the Whole', type: 'Meeting' }, { committee: 'Health', type: 'Roundtable' }, { committee: 'Health' },
      ],
      types: ['Budget Oversight Hearing'],
      topicKeywords: ['dyrs', 'juvenile*'],
      trackedBills: true,
    }, committees)).toEqual({
      committees: [youth, { ...cow, kind: 'Meeting' }, health],
      kinds: ['Budget Oversight Hearing'],
      topics: [{ name: COUNCIL_CALENDAR_TOPIC, keywords: ['dyrs', 'juvenile*', 'legislative meeting'] }],
      trackedBills: true,
    })
  })

  it('keeps only each committee\'s id and name from central\'s list', () => {
    expect(rulesFromCouncilCalendar({ include: [{ committee: 'Health' }] }, [{ ...health, chamber: 'C', state: 'DC' } as typeof health])!.committees)
      .toEqual([health])
  })

  it('selects what the fork\'s rules selected', () => {
    const r = rulesFromCouncilCalendar({ include: [{ committee: 'Legislative Meeting' }, { committee: 'Committee of the Whole', type: 'Meeting' }] }, committees)!
    expect(eventMatchesRules(event({ committeeId: null, kind: 'meeting', type: 'Meeting', title: 'Legislative Meeting', topics: [] }), r, NONE)).toBe(true)
    expect(eventMatchesRules(event({ committeeId: cow.committeeId, kind: 'meeting', type: 'Meeting', title: 'Committee of the Whole meeting' }), r, NONE)).toBe(true)
    expect(eventMatchesRules(event({ committeeId: cow.committeeId, kind: 'hearing', type: 'Hearing', title: 'Committee of the Whole hearing' }), r, NONE)).toBe(false)
  })

  it('returns null for anything else', () => {
    expect(rulesFromCouncilCalendar(null, committees)).toBeNull()
    expect(rulesFromCouncilCalendar('x', committees)).toBeNull()
    expect(rulesFromCouncilCalendar({}, committees)).toEqual(EMPTY_EVENT_RULES)
  })
})
