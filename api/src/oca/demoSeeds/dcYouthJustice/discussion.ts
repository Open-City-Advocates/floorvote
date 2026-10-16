import type { DemoSeed, DemoSeedComment, DemoSeedMention, DemoSeedReaction } from '../../../lib/demoSeeds/types'
import { H } from './bills'
import { DCYJ_ROLES, DCYJ_USER_ROLES, DCYJ_USERS } from './roster'

/**
 * Comments, reactions, votes, and notes for the alliance's twenty measures.
 *
 * The bills are real, so the discussion is held to what each measure's own
 * summary says: no invented statistics, no claims about what happened at a real
 * hearing beyond the coalition filing written testimony, and no characterization
 * of Councilmembers. Threads follow each measure's real posture: the Judiciary
 * hearing of Oct. 27 gets testimony planning, enacted laws get implementation
 * talk, and the failed and withdrawn curfew emergencies get short post-mortems.
 *
 * Comments stay short and plain, under the 120-character feed preview.
 */

const user = (id: string) => {
  const u = DCYJ_USERS.find(x => x.id === id)
  if (!u) throw new Error(`dc-youth-justice: no user ${id}`)
  return `<span data-type="mention" data-id="user:${id}" data-label="${u.name}">@${u.name}</span>`
}
const role = (id: string) => {
  const r = DCYJ_ROLES.find(x => x.id === id)
  if (!r) throw new Error(`dc-youth-justice: no role ${id}`)
  return `<span data-type="mention" data-id="role:${id}" data-label="${r.name}">@${r.name}</span>`
}
const p = (text: string) => `<p>${text}</p>`

let n = 0
const c = (bill: string, userId: string, daysAgo: number, html: string): DemoSeedComment =>
  ({ id: `dcyj-c-${++n}`, externalId: H(bill), userId, content: html, daysAgo })

export const DCYJ_COMMENTS: DemoSeedComment[] = [
  // B26-0671 Protecting Victims — Judiciary hearing in 11 days
  c('B26-0671', 'dcyj-user-la', 10, p('Judiciary set the hearing. It shares the morning with the Supporting Survivors bill.')),
  c('B26-0671', 'dcyj-user-atty', 9, p('The new felony carries a 1-to-5-year mandatory minimum and bars probation. That is where we testify.')),
  c('B26-0671', 'dcyj-user-parent', 8, p('A lot of families we work with sit on both sides of a protection order. Mandatory time will not fix that.')),
  c('B26-0671', 'demo-user', 3, p(`${role('dcyj-role-jps')} can we split it: Owen on the mandatory minimum, Priya on the 5-day hold?`)),
  c('B26-0671', 'dcyj-user-la', 2, p("Yes. I'll take the section on the 5-day hold before a detention hearing.")),
  c('B26-0671', 'dcyj-user-atty', 1, p(`Mandatory-minimum section is drafted. ${user('demo-user')} can you read it tonight?`)),

  // B26-0835 Supporting Survivors — same hearing
  c('B26-0835', 'dcyj-user-la', 10, p('Introduced late last month and already set for the same hearing. It creates an MPD domestic violence unit.')),
  c('B26-0835', 'dcyj-user-ed', 9, p("Most of this isn't our lane, but the detention piece is. Let's watch, not lead.")),
  c('B26-0835', 'dcyj-user-data', 2, p(`${user('demo-user')} I'm reading the bill's detention section against B26-0671's so we compare like with like.`)),
  c('B26-0835', 'demo-user', 1, p('Thanks. Position stays Monitor; we cover its detention piece inside the B26-0671 testimony.')),

  // B26-0038 Clemency Board waiver — hearing 23 days ago
  c('B26-0038', 'dcyj-user-atty', 24, p('Hearing is tomorrow. Our written statement supports the waiver as a reentry measure.')),
  c('B26-0038', 'dcyj-user-clinic', 23, p('Written testimony is in the record. Thanks to Owen for the edits.')),
  c('B26-0038', 'dcyj-user-reentry', 20, p('A waiver only after the federal one is granted is narrow, but it helps people who already cleared that bar.')),
  c('B26-0038', 'dcyj-user-fellow', 19, p('Glad this is moving. People I know have waited years to even apply.')),

  // B26-0188 Pretrial Detention — the Secure DC presumptions made permanent
  c('B26-0188', 'dcyj-user-atty', 60, p('Still in committee. If it moves, the expanded youth detention categories become permanent.')),
  c('B26-0188', 'dcyj-user-la', 58, p("Nothing scheduled. I'll flag it the moment it shows up on an agenda.")),
  c('B26-0188', 'dcyj-user-org', 12, p('Youth at our last meeting asked about this one by name. Can we do a one-pager?')),
  c('B26-0188', 'dcyj-user-comms', 11, p('On it. One page, plain language.')),

  // B26-0461 Youth Curfew Amendment Act — law since July
  c('B26-0461', 'dcyj-user-org', 98, p('Curfew is law now. It covers everyone under 18, and the Mayor or Chief can set extended curfew zones.')),
  c('B26-0461', 'dcyj-user-parent', 97, p('Parents need to know the zone rules. Most of them hear about it from their kids.')),
  c('B26-0461', 'dcyj-user-fellow', 30, p('Kids keep asking me how they are supposed to know when a zone is in effect.')),
  c('B26-0461', 'dcyj-user-data', 6, p(`${role('dcyj-role-jps')} starting a log of zone designations from MPD's notices, so we keep our own record.`)),

  // B26-0286 Juvenile Curfew Emergency (2025)
  c('B26-0286', 'dcyj-user-la', 110, p('This was the first emergency version, from summer 2025. The permanent act replaced it.')),
  c('B26-0286', 'dcyj-user-ed', 109, p('Keep it tracked. It shows how the curfew grew one emergency at a time.')),
  c('B26-0286', 'dcyj-user-comms', 108, p('Good timeline material for the explainer.')),

  // B26-0355 Juvenile Curfew Congressional Review Emergency — failed
  c('B26-0355', 'dcyj-user-la', 105, p('The emergency declaration failed in October 2025, so this version lapsed.')),
  c('B26-0355', 'dcyj-user-atty', 104, p('Worth a line in testimony: the Council let this one go before passing the permanent act.')),
  c('B26-0355', 'dcyj-user-org', 100, p('And then it came back anyway as permanent law.')),

  // B26-0636 Juvenile Curfew Sunset Emergency — withdrawn
  c('B26-0636', 'dcyj-user-la', 164, p('Postponed twice, then withdrawn. The permanent bill is the vehicle now.')),
  c('B26-0636', 'demo-user', 163, p('Agreed. Moving our energy to the permanent bill.')),
  c('B26-0636', 'dcyj-user-parent', 162, p('Good. One fight instead of three.')),

  // B26-0404 Safe Pregnancy ... for Youth at DYRS — law since June
  c('B26-0404', 'dcyj-user-ed', 112, p('Law as of June: pregnancy tests at admission and postpartum care on set timelines for youth in DYRS custody.')),
  c('B26-0404', 'dcyj-user-parent', 111, p('Glad this passed. Families should hear about it from us, not find out later.')),
  c('B26-0404', 'dcyj-user-data', 40, p('Next step: check whether DYRS has published a policy that implements it.')),
  c('B26-0404', 'demo-user', 39, p(`${role('dcyj-role-youth')} can someone raise this at the next DYRS oversight hearing?`)),

  // B26-0526 LEARNS — law since Oct. 2
  c('B26-0526', 'dcyj-user-atty', 14, p('LEARNS is law. DOC now owes special education to eligible people in custody from 18 on.')),
  c('B26-0526', 'dcyj-user-reentry', 13, p('That reaches young adults held at the jail, including youth charged as adults.')),
  c('B26-0526', 'dcyj-user-clinic', 5, p('Drafted a short know-your-rights note on asking DOC for an evaluation.')),
  c('B26-0526', 'demo-user', 4, p(`Great. ${user('dcyj-user-atty')} can you review Hannah's note before it goes out?`)),

  // PR26-0764 — the bridge resolution for special education at DOC
  c('PR26-0764', 'dcyj-user-la', 94, p('Emergency resolution so DOC keeps its special education contract while LEARNS waits on Congress.')),
  c('PR26-0764', 'dcyj-user-atty', 93, p('A bridge. It keeps services from lapsing for the school year.')),
  c('PR26-0764', 'dcyj-user-ed', 92, p('Thanks for tracking the bridge pieces, Priya.')),

  // B26-0479 Youth Villages Grant — hearing in June
  c('B26-0479', 'dcyj-user-org', 129, p('Hearing tomorrow. Our fellows wrote statements for the record.')),
  c('B26-0479', 'dcyj-user-fellow', 128, p('My statement is in. I wrote about what a place to go after school would have meant at 15.')),
  c('B26-0479', 'dcyj-user-ed', 60, p('Grants up to $300,000 through CFSA, starting in FY 2027. We should watch the budget for it.')),
  c('B26-0479', 'demo-user', 59, p('Agreed. Adding it to the budget watch list.')),

  // B26-0186 Justice-Involved Youth in Community
  c('B26-0186', 'dcyj-user-la', 70, p('Trusted Adults for up to 50 youth on diversion agreements, two youth per mentor. Still in committee.')),
  c('B26-0186', 'dcyj-user-fellow', 69, p("Two kids per adult is real attention. That's what works.")),
  c('B26-0186', 'dcyj-user-ed', 30, p('Let us ask about it when Youth Affairs schedules markups this fall.')),

  // B26-0413 Responsible Budgeting for Juvenile Safety Laws
  c('B26-0413', 'dcyj-user-data', 120, p('Fiscal statements would have to count youth detention costs, and capacity costs once a facility is 90% full.')),
  c('B26-0413', 'dcyj-user-ed', 119, p('This ties to the overcrowding hearing. A bill that adds detention would have to say what it costs.')),
  c('B26-0413', 'dcyj-user-la', 3, p('Still with the Committee of the Whole. No hearing scheduled.')),

  // B26-0401 Youth Records Transparency and Oversight
  c('B26-0401', 'dcyj-user-atty', 262, p('Marked up in Youth Affairs today. Opens confidential juvenile records to committee chairs and the Ombudsperson.')),
  c('B26-0401', 'dcyj-user-parent', 261, p("Oversight is good, but families need to know who can see their kid's file.")),
  c('B26-0401', 'demo-user', 260, p("We're at Amend: support oversight access with tight limits on use and redisclosure.")),
  c('B26-0401', 'dcyj-user-la', 15, p('No full Council vote yet.')),

  // B26-0402 Improving School Attendance Outcomes
  c('B26-0402', 'dcyj-user-la', 30, p('It repeals the MPD letter to parents of truant students. That part we support.')),
  c('B26-0402', 'dcyj-user-parent', 29, p('But a warning about prosecution at 15 absences scares families more than it helps.')),
  c('B26-0402', 'dcyj-user-atty', 28, p("That's the amend ask: keep the MPD repeal and the earlier OSSE notice, drop the prosecution warning.")),
  c('B26-0402', 'dcyj-user-org', 2, p('The Council truancy oversight hearing is coming up. Youth want to speak about this.')),
  c('B26-0402', 'demo-user', 1, p(`${role('dcyj-role-organizing')} let's plan who testifies at the truancy oversight hearing.`)),

  // REPROG26-0153 — $750,000 within DYRS for residential placements
  c('REPROG26-0153', 'dcyj-user-data', 21, p('Moves $750,000 within DYRS from IT hardware to court-ordered residential placements.')),
  c('REPROG26-0153', 'dcyj-user-ed', 20, p('That money is for youth waiting on placement. It follows a backlog.')),
  c('REPROG26-0153', 'dcyj-user-atty', 3, p(`${user('demo-user')} worth asking at oversight how long youth wait for placement.`)),

  // HN26-0083 — Youth Affairs hearing on overcrowding at the Youth Services Center
  c('HN26-0083', 'dcyj-user-org', 200, p('Youth Affairs put out a hearing notice on overcrowding at the Youth Services Center.')),
  c('HN26-0083', 'dcyj-user-parent', 199, p('Families have been telling us about this for months. They need to be heard.')),
  c('HN26-0083', 'demo-user', 198, p(`${role('dcyj-role-youth')} let's pull family and youth statements together for this one.`)),
  c('HN26-0083', 'dcyj-user-fellow', 195, p("I'll ask the youth council who wants to write one.")),
  c('HN26-0083', 'dcyj-user-ed', 2, p(`${user('demo-user')} overcrowding keeps coming up: this hearing, the reprogramming, the budgeting bill.`)),

  // HN26-0163 — Youth Affairs roundtable on DYRS' community placement rulemaking
  c('HN26-0163', 'dcyj-user-la', 20, p("Youth Affairs is holding a roundtable on DYRS' fifth community placement rulemaking.")),
  c('HN26-0163', 'dcyj-user-atty', 11, p('Written comments on the placement rules are submitted.')),
  c('HN26-0163', 'dcyj-user-org', 9, p('Roundtable was today. Our written comments are in the record.')),
  c('HN26-0163', 'dcyj-user-parent', 8, p('Placement close to home is what families keep asking for.')),

  // HN26-0088 — Health committee hearing on DBH's school-based behavioral health plan
  c('HN26-0088', 'dcyj-user-data', 45, p("Health committee notice on DBH's plan for school-based behavioral health.")),
  c('HN26-0088', 'dcyj-user-parent', 44, p('A school clinician is often the first adult who notices a kid is struggling.')),
  c('HN26-0088', 'dcyj-user-intern', 25, p("Pulled the program's past oversight answers into one folder for the team.")),
]

/**
 * One notification row per person a mention reaches, derived from the markup so
 * the rows and the spans cannot disagree: a role reaches each of its members, a
 * user reaches that user, and nobody is notified of their own comment
 * (api/src/lib/mentions.ts resolves them the same way).
 */
export const DCYJ_MENTIONS: DemoSeedMention[] = DCYJ_COMMENTS.flatMap((cm) => {
  const rows: DemoSeedMention[] = []
  for (const m of cm.content.matchAll(/data-id="(user|role):([^"]+)"/g)) {
    const [sourceType, sourceId] = [m[1] as 'user' | 'role', m[2]]
    const targets = sourceType === 'user'
      ? [sourceId]
      : DCYJ_USER_ROLES.filter(ur => ur.roleId === sourceId).map(ur => ur.userId)
    for (const userId of targets) {
      if (userId === cm.userId || rows.some(r => r.userId === userId)) continue
      rows.push({ id: '', commentId: cm.id, userId, sourceType, sourceId, daysAgo: cm.daysAgo })
    }
  }
  return rows
}).map((m, i) => ({ ...m, id: `dcyj-m-${i + 1}` }))

/** The comment on `bill` whose text contains `phrase`; exactly one must match. */
const commentId = (bill: string, phrase: string) => {
  const hits = DCYJ_COMMENTS.filter(x => x.externalId === H(bill) && x.content.includes(phrase))
  if (hits.length !== 1) throw new Error(`dc-youth-justice: ${hits.length} comments on ${bill} contain "${phrase}"`)
  return hits[0]
}

let r = 0
/** A reaction `lag` days after its comment (never before it). */
const react = (bill: string, phrase: string, userId: string, emoji: string, lag = 0): DemoSeedReaction => {
  const cm = commentId(bill, phrase)
  return { id: `dcyj-r-${++r}`, commentId: cm.id, userId, emoji, daysAgo: Math.max(0, cm.daysAgo - lag) }
}

export const DCYJ_REACTIONS: DemoSeedReaction[] = [
  react('B26-0671', 'The new felony', 'demo-user', '💯'),
  react('B26-0671', 'The new felony', 'dcyj-user-la', '👍'),
  react('B26-0671', 'The new felony', 'dcyj-user-parent', '👍'),
  react('B26-0671', 'A lot of families', 'dcyj-user-org', '❤️'),
  react('B26-0671', 'A lot of families', 'dcyj-user-atty', '💯'),
  react('B26-0671', 'Yes.', 'demo-user', '👍'),
  react('B26-0671', 'Mandatory-minimum section', 'dcyj-user-la', '🔥'),
  react('B26-0671', 'Mandatory-minimum section', 'dcyj-user-ed', '👍'),
  react('B26-0835', 'Most of this', 'demo-user', '👍'),
  react('B26-0835', 'Most of this', 'dcyj-user-atty', '👍'),
  react('B26-0038', 'Written testimony is in', 'dcyj-user-atty', '❤️'),
  react('B26-0038', 'Written testimony is in', 'dcyj-user-reentry', '🔥'),
  react('B26-0038', 'Glad this is moving', 'dcyj-user-reentry', '❤️'),
  react('B26-0188', 'Youth at our last meeting', 'dcyj-user-fellow', '👍'),
  react('B26-0188', 'On it.', 'dcyj-user-org', '❤️'),
  react('B26-0461', 'Curfew is law now', 'dcyj-user-fellow', '😭'),
  react('B26-0461', 'Curfew is law now', 'dcyj-user-parent', '👎'),
  react('B26-0461', 'Kids keep asking me', 'dcyj-user-org', '🤔'),
  react('B26-0461', 'starting a log', 'demo-user', '🔥', 0),
  react('B26-0461', 'starting a log', 'dcyj-user-la', '👍'),
  react('B26-0355', 'And then it came back', 'dcyj-user-parent', '😭'),
  react('B26-0355', 'And then it came back', 'dcyj-user-fellow', '👎'),
  react('B26-0636', 'Good. One fight', 'dcyj-user-la', '💯'),
  react('B26-0404', 'Law as of June', 'dcyj-user-parent', '❤️'),
  react('B26-0404', 'Law as of June', 'dcyj-user-org', '❤️'),
  react('B26-0526', 'LEARNS is law', 'dcyj-user-reentry', '🔥'),
  react('B26-0526', 'LEARNS is law', 'demo-user', '🔥'),
  react('B26-0526', 'LEARNS is law', 'dcyj-user-clinic', '💯'),
  react('B26-0526', 'Drafted a short', 'dcyj-user-atty', '❤️'),
  react('B26-0479', 'My statement is in', 'dcyj-user-org', '❤️'),
  react('B26-0479', 'My statement is in', 'dcyj-user-ed', '❤️'),
  react('B26-0186', 'Two kids per adult', 'dcyj-user-org', '💯'),
  react('B26-0401', 'Oversight is good', 'dcyj-user-atty', '🤔'),
  react('B26-0402', 'But a warning', 'dcyj-user-org', '💯'),
  react('B26-0402', 'But a warning', 'dcyj-user-fellow', '👍'),
  react('B26-0402', 'The Council truancy', 'dcyj-user-fellow', '🔥'),
  react('REPROG26-0153', 'That money is', 'dcyj-user-parent', '🤔'),
  react('HN26-0083', 'Families have been telling', 'dcyj-user-org', '💯'),
  react('HN26-0083', 'overcrowding keeps coming up', 'dcyj-user-data', '💯', 0),
  react('HN26-0163', 'Placement close to home', 'dcyj-user-org', '❤️'),
]

// Member votes: support (s), oppose (o), neutral (n), per measure. Only members
// who can vote appear; the clinic student and the intern cannot.
const VOTES: Array<[bill: string, daysAgo: number, by: Record<string, 's' | 'o' | 'n'>]> = [
  ['B26-0671', 8, { 'demo-user': 'o', 'dcyj-user-atty': 'o', 'dcyj-user-la': 'o', 'dcyj-user-parent': 'n', 'dcyj-user-org': 'o', 'dcyj-user-ed': 'n', 'dcyj-user-data': 'n', 'dcyj-user-comms': 'o' }],
  ['B26-0835', 8, { 'dcyj-user-ed': 'n', 'demo-user': 'n', 'dcyj-user-la': 's', 'dcyj-user-data': 'n', 'dcyj-user-parent': 's' }],
  ['B26-0461', 150, { 'dcyj-user-org': 'o', 'dcyj-user-parent': 'o', 'dcyj-user-fellow': 'o', 'demo-user': 'o', 'dcyj-user-atty': 'o', 'dcyj-user-la': 'o', 'dcyj-user-comms': 'o', 'dcyj-user-reentry': 'n' }],
  ['B26-0188', 290, { 'dcyj-user-atty': 'o', 'demo-user': 'o', 'dcyj-user-la': 'o', 'dcyj-user-org': 'o', 'dcyj-user-fellow': 'o', 'dcyj-user-ed': 'o', 'dcyj-user-parent': 'n' }],
  ['B26-0404', 240, { 'dcyj-user-ed': 's', 'dcyj-user-parent': 's', 'demo-user': 's', 'dcyj-user-data': 's', 'dcyj-user-org': 's', 'dcyj-user-fellow': 's' }],
  ['B26-0526', 210, { 'dcyj-user-atty': 's', 'dcyj-user-reentry': 's', 'demo-user': 's', 'dcyj-user-la': 's', 'dcyj-user-ed': 's' }],
  ['B26-0479', 140, { 'dcyj-user-org': 's', 'dcyj-user-fellow': 's', 'dcyj-user-ed': 's', 'demo-user': 's', 'dcyj-user-parent': 's', 'dcyj-user-data': 'n' }],
  ['B26-0186', 290, { 'dcyj-user-la': 's', 'dcyj-user-fellow': 's', 'demo-user': 's', 'dcyj-user-org': 's', 'dcyj-user-parent': 's', 'dcyj-user-atty': 'n' }],
  ['B26-0413', 240, { 'dcyj-user-data': 's', 'dcyj-user-ed': 's', 'demo-user': 's', 'dcyj-user-la': 'n', 'dcyj-user-comms': 's' }],
  ['B26-0401', 255, { 'dcyj-user-atty': 'n', 'dcyj-user-parent': 'o', 'demo-user': 'n', 'dcyj-user-la': 's', 'dcyj-user-ed': 'n' }],
  ['B26-0402', 27, { 'dcyj-user-la': 'n', 'dcyj-user-parent': 'o', 'dcyj-user-atty': 'n', 'dcyj-user-org': 'o', 'demo-user': 'n', 'dcyj-user-fellow': 'o' }],
  ['B26-0038', 22, { 'dcyj-user-atty': 's', 'dcyj-user-reentry': 's', 'demo-user': 's', 'dcyj-user-ed': 's' }],
]
const POSITION = { s: 'support', o: 'oppose', n: 'neutral' } as const

export const DCYJ_VOTES: DemoSeed['votes'] = VOTES.flatMap(([bill, daysAgo, by], bi) =>
  Object.entries(by).map(([userId, v], ui) => ({
    id: `dcyj-v-${bi + 1}-${ui + 1}`,
    externalId: H(bill),
    userId,
    position: POSITION[v],
    // Stagger within a bill so the votes don't all land in the same second.
    daysAgo: Math.max(0, daysAgo - (ui % 3)),
  })),
)

export const DCYJ_NOTES: DemoSeed['notes'] = [
  { id: 'dcyj-n-1', externalId: H('B26-0671'), daysAgo: 2,
    content: '<p>Ask committee staff whether the 5-day hold applies to youth charged as adults.</p>' },
  { id: 'dcyj-n-2', externalId: H('B26-0402'), daysAgo: 27,
    content: '<p>Find out how many students reach 10 unexcused absences in a year before we argue about 15.</p>' },
  { id: 'dcyj-n-3', externalId: H('REPROG26-0153'), daysAgo: 20,
    content: '<p>Compare with last year: was there a placements reprogramming in FY 2025 too?</p>' },
]
