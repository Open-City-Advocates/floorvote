import type { DemoSeedCalendarEvent, DemoSeedFeedEvent } from '../../../lib/demoSeeds/types'

// Twenty real Council Period 26 measures, chosen 2026-10-16 from OCA's team:
// the eleven OCA had given a priority (kept at OCA's own level) plus nine of its
// highest-relevance juvenile-justice measures. Where a measure came in several
// versions (the curfew emergencies, temporaries, and permanent act), the set keeps
// the versions a visitor needs to follow the story, not every one.
//
// Handles are `legiscan:<central id>`, and a LIMS measure's central id is computed
// from its number (central/src/providers/lims/ids.ts): B26-0461 is 1_012_600_461.
//
// Every date in this seed is a day offset from the reset, set as of 2026-10-16:
// a real action dated 2026-10-06 is `daysAgo: 10`. The demo therefore always reads
// as if it were mid-October 2026, which the banner discloses.
export const DCYJ_BILLS: Array<{
  externalId: string
  number: string
  priority: 'high' | 'medium' | 'low'
  prioritySetBy: string
  prioritySetDaysAgo: number
}> = [
  // ── OCA's priorities ──
  { externalId: 'legiscan:1082600083', number: 'HN26-0083',     priority: 'high',   prioritySetBy: 'demo-user',      prioritySetDaysAgo: 201 }, // Overcrowding at the Youth Services Center (hearing notice)
  { externalId: 'legiscan:1082600163', number: 'HN26-0163',     priority: 'high',   prioritySetBy: 'dcyj-user-la',   prioritySetDaysAgo: 21 },  // Youth Affairs roundtable, DYRS community placement rulemaking
  { externalId: 'legiscan:1012600286', number: 'B26-0286',      priority: 'medium', prioritySetBy: 'dcyj-user-la',   prioritySetDaysAgo: 466 }, // Juvenile Curfew Emergency (2025)
  { externalId: 'legiscan:1012600355', number: 'B26-0355',      priority: 'medium', prioritySetBy: 'dcyj-user-la',   prioritySetDaysAgo: 395 }, // Juvenile Curfew Congressional Review Emergency (failed)
  { externalId: 'legiscan:1012600404', number: 'B26-0404',      priority: 'medium', prioritySetBy: 'dcyj-user-ed',   prioritySetDaysAgo: 300 }, // Safe Pregnancy ... for Youth at DYRS (law)
  { externalId: 'legiscan:1012600526', number: 'B26-0526',      priority: 'medium', prioritySetBy: 'dcyj-user-atty', prioritySetDaysAgo: 220 }, // LEARNS (law)
  { externalId: 'legiscan:1012600671', number: 'B26-0671',      priority: 'medium', prioritySetBy: 'dcyj-user-atty', prioritySetDaysAgo: 165 }, // Protecting Victims (hearing)
  { externalId: 'legiscan:1012600188', number: 'B26-0188',      priority: 'low',    prioritySetBy: 'dcyj-user-atty', prioritySetDaysAgo: 300 }, // Pretrial Detention (Secure DC permanence)
  { externalId: 'legiscan:1012600479', number: 'B26-0479',      priority: 'low',    prioritySetBy: 'dcyj-user-ed',   prioritySetDaysAgo: 165 }, // Youth Villages Grant
  { externalId: 'legiscan:1022600764', number: 'PR26-0764',     priority: 'low',    prioritySetBy: 'dcyj-user-la',   prioritySetDaysAgo: 95 },  // Special education at DOC, emergency resolution
  { externalId: 'legiscan:1082600088', number: 'HN26-0088',     priority: 'low',    prioritySetBy: 'dcyj-user-data', prioritySetDaysAgo: 46 },  // DBH school-based behavioral health plan (hearing notice)
  // ── Added from OCA's highest-relevance measures ──
  { externalId: 'legiscan:1012600461', number: 'B26-0461',      priority: 'high',   prioritySetBy: 'dcyj-user-la',   prioritySetDaysAgo: 200 }, // Youth Curfew Amendment Act (law)
  { externalId: 'legiscan:1012600402', number: 'B26-0402',      priority: 'high',   prioritySetBy: 'demo-user',      prioritySetDaysAgo: 374 }, // Improving School Attendance Outcomes
  { externalId: 'legiscan:1012600636', number: 'B26-0636',      priority: 'low',    prioritySetBy: 'dcyj-user-la',   prioritySetDaysAgo: 200 }, // Juvenile Curfew Sunset Emergency (withdrawn)
  { externalId: 'legiscan:1012600186', number: 'B26-0186',      priority: 'medium', prioritySetBy: 'demo-user',      prioritySetDaysAgo: 300 }, // Justice-Involved Youth in Community
  { externalId: 'legiscan:1012600413', number: 'B26-0413',      priority: 'medium', prioritySetBy: 'dcyj-user-ed',   prioritySetDaysAgo: 374 }, // Responsible Budgeting for Juvenile Safety Laws
  { externalId: 'legiscan:1012600038', number: 'B26-0038',      priority: 'low',    prioritySetBy: 'dcyj-user-atty', prioritySetDaysAgo: 47 },  // Clemency Board Waiver Authority
  { externalId: 'legiscan:1012600401', number: 'B26-0401',      priority: 'medium', prioritySetBy: 'demo-user',      prioritySetDaysAgo: 337 }, // Youth Records Transparency and Oversight
  { externalId: 'legiscan:1062600153', number: 'REPROG26-0153', priority: 'medium', prioritySetBy: 'dcyj-user-data', prioritySetDaysAgo: 22 },  // $750,000 within DYRS for residential placements
  { externalId: 'legiscan:1012600835', number: 'B26-0835',      priority: 'medium', prioritySetBy: 'dcyj-user-la',   prioritySetDaysAgo: 17 },  // Supporting Survivors of Domestic Violence (hearing)
]

/** Look a handle up by measure number, so the rest of the seed reads in numbers. */
export const H = (number: string): string => {
  const b = DCYJ_BILLS.find(x => x.number === number)
  if (!b) throw new Error(`dc-youth-justice: no bill ${number}`)
  return b.externalId
}

// Official positions, set only by one of the three admins. Hearing notices and
// the reprogramming carry none; a coalition takes positions on legislation.
export const DCYJ_POSITIONS: Array<{ id: string; externalId: string; position: string; setBy: string; daysAgo: number }> = [
  { id: 'dcyj-pos-1',  externalId: H('B26-0286'),  position: 'Oppose',  setBy: 'demo-user',      daysAgo: 465 },
  { id: 'dcyj-pos-2',  externalId: H('B26-0355'),  position: 'Oppose',  setBy: 'demo-user',      daysAgo: 394 },
  { id: 'dcyj-pos-3',  externalId: H('B26-0461'),  position: 'Oppose',  setBy: 'dcyj-user-atty', daysAgo: 199 },
  { id: 'dcyj-pos-4',  externalId: H('B26-0636'),  position: 'Oppose',  setBy: 'demo-user',      daysAgo: 199 },
  { id: 'dcyj-pos-5',  externalId: H('B26-0188'),  position: 'Oppose',  setBy: 'dcyj-user-atty', daysAgo: 299 },
  { id: 'dcyj-pos-6',  externalId: H('B26-0671'),  position: 'Amend',   setBy: 'dcyj-user-atty', daysAgo: 9 },
  { id: 'dcyj-pos-7',  externalId: H('B26-0835'),  position: 'Monitor', setBy: 'dcyj-user-ed',   daysAgo: 9 },
  { id: 'dcyj-pos-8',  externalId: H('B26-0404'),  position: 'Support', setBy: 'dcyj-user-ed',   daysAgo: 299 },
  { id: 'dcyj-pos-9',  externalId: H('B26-0526'),  position: 'Support', setBy: 'dcyj-user-atty', daysAgo: 219 },
  { id: 'dcyj-pos-10', externalId: H('PR26-0764'), position: 'Support', setBy: 'dcyj-user-atty', daysAgo: 94 },
  { id: 'dcyj-pos-11', externalId: H('B26-0186'),  position: 'Support', setBy: 'demo-user',      daysAgo: 299 },
  { id: 'dcyj-pos-12', externalId: H('B26-0479'),  position: 'Support', setBy: 'dcyj-user-ed',   daysAgo: 150 },
  { id: 'dcyj-pos-13', externalId: H('B26-0413'),  position: 'Support', setBy: 'dcyj-user-ed',   daysAgo: 370 },
  { id: 'dcyj-pos-14', externalId: H('B26-0401'),  position: 'Amend',   setBy: 'demo-user',      daysAgo: 260 },
  { id: 'dcyj-pos-15', externalId: H('B26-0402'),  position: 'Amend',   setBy: 'dcyj-user-atty', daysAgo: 28 },
  { id: 'dcyj-pos-16', externalId: H('B26-0038'),  position: 'Support', setBy: 'dcyj-user-atty', daysAgo: 46 },
]

export const DCYJ_CUSTOM_FIELD_VALUES: Array<{ externalId: string; fieldId: string; value: string; setBy: string; daysAgo: number }> = [
  // Lead Committee (dcyj-cf-1), only where the measure's own history names it
  { externalId: H('B26-0671'),  fieldId: 'dcyj-cf-1', value: 'Judiciary and Public Safety', setBy: 'dcyj-user-la', daysAgo: 164 }, // referred 2026-05-05
  { externalId: H('B26-0835'),  fieldId: 'dcyj-cf-1', value: 'Judiciary and Public Safety', setBy: 'dcyj-user-la', daysAgo: 10 },  // referred 2026-10-06
  { externalId: H('B26-0038'),  fieldId: 'dcyj-cf-1', value: 'Judiciary and Public Safety', setBy: 'dcyj-user-la', daysAgo: 46 },  // its hearing notice
  { externalId: H('B26-0401'),  fieldId: 'dcyj-cf-1', value: 'Youth Affairs',               setBy: 'dcyj-user-la', daysAgo: 262 }, // marked up by Youth Affairs
  { externalId: H('B26-0479'),  fieldId: 'dcyj-cf-1', value: 'Youth Affairs',               setBy: 'dcyj-user-la', daysAgo: 165 }, // its hearing notice
  { externalId: H('B26-0186'),  fieldId: 'dcyj-cf-1', value: 'Youth Affairs',               setBy: 'dcyj-user-la', daysAgo: 300 }, // its roundtable
  { externalId: H('B26-0402'),  fieldId: 'dcyj-cf-1', value: 'Committee of the Whole',      setBy: 'dcyj-user-la', daysAgo: 332 },
  { externalId: H('B26-0413'),  fieldId: 'dcyj-cf-1', value: 'Committee of the Whole',      setBy: 'dcyj-user-la', daysAgo: 374 },
  { externalId: H('HN26-0083'), fieldId: 'dcyj-cf-1', value: 'Youth Affairs',               setBy: 'dcyj-user-la', daysAgo: 201 },
  { externalId: H('HN26-0163'), fieldId: 'dcyj-cf-1', value: 'Youth Affairs',               setBy: 'dcyj-user-la', daysAgo: 21 },
  { externalId: H('HN26-0088'), fieldId: 'dcyj-cf-1', value: 'Health',                      setBy: 'dcyj-user-la', daysAgo: 46 },

  // Coalition Sign-on (dcyj-cf-2)
  { externalId: H('B26-0671'), fieldId: 'dcyj-cf-2', value: 'Circulating', setBy: 'demo-user',      daysAgo: 3 },
  { externalId: H('B26-0402'), fieldId: 'dcyj-cf-2', value: 'Circulating', setBy: 'dcyj-user-atty', daysAgo: 27 },
  { externalId: H('B26-0461'), fieldId: 'dcyj-cf-2', value: 'Signed',      setBy: 'dcyj-user-ed',   daysAgo: 190 },
  { externalId: H('B26-0188'), fieldId: 'dcyj-cf-2', value: 'Signed',      setBy: 'dcyj-user-ed',   daysAgo: 290 },
  { externalId: H('B26-0186'), fieldId: 'dcyj-cf-2', value: 'Signed',      setBy: 'demo-user',      daysAgo: 290 },

  // Talking Points (dcyj-cf-3, pinned rich text). Each claim is in the measure's
  // own summary; the asks are the coalition's.
  { externalId: H('B26-0671'), fieldId: 'dcyj-cf-3', setBy: 'dcyj-user-atty', daysAgo: 1,
    value: '<p>Oppose the new 1-to-5-year mandatory minimum and the non-discretionary 5-day hold before a detention hearing; both take the decision away from a judge. Ask the committee to keep pretrial decisions individualized.</p>' },
  { externalId: H('B26-0402'), fieldId: 'dcyj-cf-3', setBy: 'dcyj-user-atty', daysAgo: 27,
    value: '<p>Support repealing the MPD letter to parents and the earlier OSSE notice at 5 unexcused days. Oppose the Attorney General warning letter about prosecution at 15 absences: attendance is a school and family-support problem, not a court problem.</p>' },
  { externalId: H('HN26-0083'), fieldId: 'dcyj-cf-3', setBy: 'demo-user', daysAgo: 2,
    value: '<p>Overcrowding at the Youth Services Center is a capacity and placement problem. Tie it to the $750,000 DYRS reprogramming for residential placements and to the Responsible Budgeting bill.</p>' },
  { externalId: H('B26-0188'), fieldId: 'dcyj-cf-3', setBy: 'dcyj-user-atty', daysAgo: 60,
    value: '<p>Oppose making the Secure DC pretrial detention presumptions permanent, especially the expanded detention categories for youth.</p>' },

  // Effective Date (dcyj-cf-4) — real dates from each enacted measure's history
  { externalId: H('B26-0526'),  fieldId: 'dcyj-cf-4', value: '2026-10-02', setBy: 'dcyj-user-atty', daysAgo: 14 },
  { externalId: H('B26-0404'),  fieldId: 'dcyj-cf-4', value: '2026-06-11', setBy: 'dcyj-user-ed',   daysAgo: 112 },
  { externalId: H('B26-0461'),  fieldId: 'dcyj-cf-4', value: '2026-07-02', setBy: 'dcyj-user-la',   daysAgo: 98 },
  { externalId: H('PR26-0764'), fieldId: 'dcyj-cf-4', value: '2026-07-14', setBy: 'dcyj-user-la',   daysAgo: 84 },

  // Testimony Submitted (dcyj-cf-5) — pinned to the thread that says so
  { externalId: H('B26-0038'),  fieldId: 'dcyj-cf-5', value: '1', setBy: 'dcyj-user-atty', daysAgo: 24 },
  { externalId: H('B26-0479'),  fieldId: 'dcyj-cf-5', value: '1', setBy: 'dcyj-user-org',  daysAgo: 128 },
  { externalId: H('B26-0401'),  fieldId: 'dcyj-cf-5', value: '1', setBy: 'dcyj-user-atty', daysAgo: 338 },
  { externalId: H('HN26-0163'), fieldId: 'dcyj-cf-5', value: '1', setBy: 'dcyj-user-atty', daysAgo: 11 },
]

// The Council's real calendar, from the LIMS hearings central archived on
// 2026-10-14 (floorvote-deploy archive/central-council_events-2026-10-14.sql):
// committee, room, time, and agenda are as published, and the offset is the real
// date's distance from 2026-10-16. Offsets are relative to each reset, so the
// dates shift with the demo; everything else stays real. Rooms are in the John A.
// Wilson Building. The coalition's own meetings are fictional.
//
// The Judiciary hearing of 2026-10-27 carries both B26-0671 and B26-0835, so it
// appears once per bill, each row linked to its own measure.
export const DCYJ_CALENDAR_EVENTS: DemoSeedCalendarEvent[] = [
  { id: 'dcyj-hearing-1', externalId: H('B26-0671'), source: 'hearing', offsetDays: 11, time: '09:00:00', location: 'Room 412, John A. Wilson Building', description: 'Committee on Judiciary and Public Safety — public hearing' },
  { id: 'dcyj-hearing-2', externalId: H('B26-0835'), source: 'hearing', offsetDays: 11, time: '09:00:00', location: 'Room 412, John A. Wilson Building', description: 'Committee on Judiciary and Public Safety — public hearing' },
  { id: 'dcyj-hearing-past-1', externalId: H('B26-0038'), source: 'hearing', offsetDays: -23, time: '09:00:00', location: 'Room 123, John A. Wilson Building', description: 'Committee on Judiciary and Public Safety — public hearing' },
  { id: 'dcyj-hearing-past-2', externalId: H('HN26-0163'), source: 'hearing', offsetDays: -9, time: '12:00:00', location: 'Room 412, John A. Wilson Building', description: "Committee on Youth Affairs — roundtable on DYRS' fifth rulemaking on community placement" },

  // Real Council events the coalition follows that are not on one of its measures
  { id: 'dcyj-council-1', externalId: null, source: 'custom', offsetDays: 20, time: '09:00:00', location: 'Room 412, John A. Wilson Building', description: 'Council: Judiciary and Public Safety hearing on policing bills (B26-0549, B26-0603, B26-0618)' },
  { id: 'dcyj-council-2', externalId: null, source: 'custom', offsetDays: 25, time: '12:00:00', location: 'Room 500, John A. Wilson Building', description: 'Council: Legislative Meeting' },
  { id: 'dcyj-council-3', externalId: null, source: 'custom', offsetDays: 27, time: '10:00:00', location: 'Room 500, John A. Wilson Building', description: 'Council: Committee of the Whole oversight hearing on chronic absenteeism and truancy' },
  { id: 'dcyj-council-past-1', externalId: null, source: 'custom', offsetDays: -10, time: '12:00:00', location: 'Room 500, John A. Wilson Building', description: 'Council: Thirty-Seventh Legislative Meeting' },

  // The alliance's own calendar (fictional)
  { id: 'dcyj-event-1', externalId: H('B26-0671'), source: 'custom', offsetDays: 4, time: '17:00:00', location: null, description: 'Testimony drafts due — B26-0671 and B26-0835 (Oct. 27 hearing)' },
  { id: 'dcyj-event-2', externalId: null, source: 'custom', offsetDays: 6, time: '18:00:00', location: 'Alliance office', description: 'Youth testimony prep night' },
  { id: 'dcyj-event-3', externalId: null, source: 'custom', offsetDays: 18, time: '10:00:00', location: 'Zoom', description: 'Alliance monthly meeting' },
  { id: 'dcyj-event-past-1', externalId: null, source: 'custom', offsetDays: -12, time: '10:00:00', location: 'Zoom', description: 'Alliance monthly meeting' },
  { id: 'dcyj-event-past-2', externalId: null, source: 'custom', offsetDays: -31, time: '18:30:00', location: 'Alliance office', description: 'Family listening session on curfew zones' },
]

/** One entry in a bill_updated event's `changes` array, matching ChangeRecord. */
const chg = (changeType: string, f: { oldValue?: string | null; newValue?: string; detail?: string } = {}) =>
  ({ changeType, oldValue: f.oldValue ?? null, newValue: f.newValue ?? null, detail: f.detail ?? null })

const upd = (id: string, number: string, daysAgo: number, changes: ReturnType<typeof chg>[]): DemoSeedFeedEvent =>
  ({ id: `dcyj-fe-u-${id}`, type: 'bill_updated', externalId: H(number), userId: 'system', daysAgo, metadata: { changes } })

// Legislative activity. Every action string is verbatim from the measure's LIMS
// history as OCA's team holds it, and every daysAgo is that action's real date
// counted back from 2026-10-16. Nothing here is invented: the newest real actions
// (B26-0835's referral, B26-0526 becoming law) fall inside the last two weeks,
// so the feed has real legislative activity at the top without fabricating any.
// status_change appears only where the history itself records the new status.
export const DCYJ_BILL_UPDATED_EVENTS: DemoSeedFeedEvent[] = [
  upd('b0835-1', 'B26-0835', 17, [chg('action_added', { newValue: 'B26-0835 Introduced by Councilmember Pinto at Office of the Secretary' })]),
  upd('b0835-2', 'B26-0835', 10, [
    chg('action_added', { newValue: 'Referred to Committee on Judiciary and Public Safety' }),
    chg('action_added', { newValue: 'Notice of Public Hearing filed in the Office of Secretary by Judiciary and Public Safety' }),
  ]),
  upd('b0835-3', 'B26-0835', 7, [chg('action_added', { newValue: 'Notice of Intent to Act on B26-0835 Published in the District of Columbia Register' })]),

  upd('b0671-1', 'B26-0671', 164, [chg('action_added', { newValue: 'Referred to Committee on Judiciary and Public Safety' })]),
  upd('b0671-2', 'B26-0671', 10, [chg('action_added', { newValue: 'Notice of Public Hearing filed in the Office of Secretary by Judiciary and Public Safety' })]),

  upd('b0526-1', 'B26-0526', 106, [chg('action_added', { newValue: "Enacted without Mayor's Signature with Act Number A26-0368" })]),
  upd('b0526-2', 'B26-0526', 14, [
    chg('status_change', { newValue: 'Official Law' }),
    chg('action_added', { newValue: 'Law Number L26-0188 Effective from Oct 02, 2026' }),
  ]),

  upd('r0153-1', 'REPROG26-0153', 22, [chg('action_added', { newValue: 'REPROG26-0153 Introduced by Chairman Mendelson at Office of the Secretary' })]),
  upd('r0153-2', 'REPROG26-0153', 21, [chg('action_added', { newValue: 'Retained by the Council with comments from the Committee on Youth Affairs' })]),

  upd('b0038-1', 'B26-0038', 46, [chg('action_added', { newValue: 'Notice of Public Hearing filed in the Office of Secretary by Judiciary and Public Safety' })]),
  upd('b0038-2', 'B26-0038', 23, [chg('action_added', { newValue: 'Public Hearing on B26-0038' })]),

  upd('pr0764-1', 'PR26-0764', 94, [
    chg('status_change', { newValue: 'Approved' }),
    chg('action_added', { newValue: 'Approved with Resolution Number R26-0492' }),
  ]),

  upd('b0404-1', 'B26-0404', 175, [chg('action_added', { newValue: 'Signed by the Mayor and Enacted with Act Number A26-0310' })]),
  upd('b0404-2', 'B26-0404', 112, [
    chg('status_change', { newValue: 'Official Law' }),
    chg('action_added', { newValue: 'Law L26-0130, Effective from Jun 11, 2026 Published in DC Register Vol 73 and Page 008884' }),
  ]),

  upd('b0461-1', 'B26-0461', 155, [chg('action_added', { newValue: 'Signed by the Mayor and Enacted with Act Number A26-0317' })]),
  upd('b0461-2', 'B26-0461', 98, [
    chg('status_change', { newValue: 'Official Law' }),
    chg('action_added', { newValue: 'Law L26-0140, Effective from Jul 02, 2026 Published in DC Register Vol 73 and Page 009380' }),
  ]),

  upd('b0636-1', 'B26-0636', 200, [chg('action_added', { newValue: 'B26-0636 Introduced by Councilmember Pinto at Office of the Secretary' })]),
  upd('b0636-2', 'B26-0636', 164, [
    chg('status_change', { newValue: 'Withdrawn' }),
    chg('action_added', { newValue: 'Withdrawn' }),
  ]),

  upd('b0479-1', 'B26-0479', 165, [chg('action_added', { newValue: 'Notice of Public Hearing filed in the Office of Secretary by Youth Affairs' })]),
  upd('b0479-2', 'B26-0479', 128, [chg('action_added', { newValue: 'Public Hearing on B26-0479' })]),

  upd('b0401-1', 'B26-0401', 337, [chg('action_added', { newValue: 'Public Hearing on B26-0401' })]),
  upd('b0401-2', 'B26-0401', 262, [chg('action_added', { newValue: 'Committee Mark-up of B26-0401 by the Youth Affairs Committee' })]),

  upd('b0402-1', 'B26-0402', 374, [chg('action_added', { newValue: 'Referred to Committee of the Whole with comments from the Committee on Youth Affairs' })]),
  upd('b0402-2', 'B26-0402', 332, [chg('action_added', { newValue: 'Re-Referred to Committee of the Whole with comments from the Committee on Human Services, and Committee on Youth Affairs' })]),

  upd('b0413-1', 'B26-0413', 374, [chg('action_added', { newValue: 'Referred to Committee of the Whole with comments from the Committee on Youth Affairs, and Committee on Business and Economic Development' })]),

  upd('b0355-1', 'B26-0355', 395, [chg('action_added', { newValue: 'B26-0355 Introduced by Councilmember Pinto at Office of the Secretary' })]),
  upd('b0355-2', 'B26-0355', 374, [chg('action_added', { newValue: 'Not Considered; Emergency Declaration Failed' })]),

  upd('b0286-1', 'B26-0286', 466, [chg('action_added', { newValue: 'Signed by the Mayor and Enacted with Act Number A26-0104, Expires on Oct 05, 2025' })]),
]

/**
 * A hearing notice derived from its calendar row, so the feed card and the
 * calendar cannot disagree. No `date`: the calendar's date is computed at reset.
 */
const hearingNotice = (id: string, calendarId: string, daysAgo: number): DemoSeedFeedEvent => {
  const h = DCYJ_CALENDAR_EVENTS.find(e => e.id === calendarId)
  if (!h || h.source !== 'hearing' || h.externalId === null) {
    throw new Error(`hearingNotice: no bill-linked hearing calendar entry ${calendarId}`)
  }
  return {
    id, type: 'hearing_added', externalId: h.externalId, userId: 'system',
    metadata: { time: h.time, location: h.location, description: h.description },
    daysAgo,
  }
}

// Each notice lands on the day the real notice was filed (B26-0671 and B26-0835
// on 2026-10-06, B26-0038 on 2026-08-31). The roundtable notice's filing date
// isn't in the measure's record, so it sits a few days before the thread that
// first mentions it.
export const DCYJ_HEARING_NOTICE_SOURCES: ReadonlyArray<{ eventId: string; calendarId: string; daysAgo: number }> = [
  { eventId: 'dcyj-fe-h-b0671', calendarId: 'dcyj-hearing-1', daysAgo: 10 },
  { eventId: 'dcyj-fe-h-b0835', calendarId: 'dcyj-hearing-2', daysAgo: 10 },
  { eventId: 'dcyj-fe-h-b0038', calendarId: 'dcyj-hearing-past-1', daysAgo: 46 },
  { eventId: 'dcyj-fe-h-hn0163', calendarId: 'dcyj-hearing-past-2', daysAgo: 22 },
]

export const DCYJ_HEARING_EVENTS: DemoSeedFeedEvent[] =
  DCYJ_HEARING_NOTICE_SOURCES.map(n => hearingNotice(n.eventId, n.calendarId, n.daysAgo))
