import { stripHtml, truncateWithEllipsis, COMMENT_PREVIEW_MAX } from '../../../../../shared/feedUtils'
import { parseHandle } from '../../../../../shared/billHandle'
import type { DemoSeed, DemoSeedFeedEvent } from '../../../lib/demoSeeds/types'
import { viewQuery } from '../../../lib/demoSeeds/viewQuery'
import { DCYJ_ORG } from './org'
import { DCYJ_CUSTOM_FIELDS, DCYJ_ROLES, DCYJ_USER_ROLES, DCYJ_USERS } from './roster'
import {
  DCYJ_BILLS,
  DCYJ_BILL_UPDATED_EVENTS,
  DCYJ_CALENDAR_EVENTS,
  DCYJ_CUSTOM_FIELD_VALUES,
  DCYJ_HEARING_EVENTS,
  DCYJ_POSITIONS,
} from './bills'
import { DCYJ_COMMENTS, DCYJ_MENTIONS, DCYJ_NOTES, DCYJ_REACTIONS, DCYJ_VOTES } from './discussion'

/**
 * A public demo of FloorVote for a DC youth-justice coalition: real Council
 * Period 26 measures, a fictional alliance. Deployed as the `dc-demo` tenant with
 * DEMO_SEED = "dc-youth-justice"; its bill summaries are copied once from OCA's
 * team (floorvote-deploy tools/demo/copy-summaries.py), since a demo never calls
 * the model.
 *
 * Feed events for priorities, positions, comments, and vote milestones are
 * derived from the rows they describe, so a feed card can never disagree with
 * the bill it points at.
 */

const priorityEvents: DemoSeedFeedEvent[] = DCYJ_BILLS.map(b => ({
  id: `dcyj-fe-p-${b.number.toLowerCase()}`,
  type: 'priority_set' as const,
  externalId: b.externalId,
  userId: b.prioritySetBy,
  metadata: { priority: b.priority },
  daysAgo: b.prioritySetDaysAgo,
}))

const positionEvents: DemoSeedFeedEvent[] = DCYJ_POSITIONS.map(p => ({
  id: `dcyj-fe-o-${p.id.replace(/^dcyj-pos-/, '')}`,
  type: 'position_set' as const,
  externalId: p.externalId,
  userId: p.setBy,
  metadata: { position: p.position },
  daysAgo: p.daysAgo,
}))

const commentEvents: DemoSeedFeedEvent[] = DCYJ_COMMENTS.map((c) => {
  const mentioned = [...new Set(DCYJ_MENTIONS.filter(m => m.commentId === c.id).map(m => m.userId))]
  return {
    id: `dcyj-fe-c-${c.id.replace(/^dcyj-c-/, '')}`,
    type: 'comment_added' as const,
    externalId: c.externalId,
    userId: c.userId,
    metadata: {
      commentId: c.id,
      preview: truncateWithEllipsis(stripHtml(c.content), COMMENT_PREVIEW_MAX),
      ...(mentioned.length ? { mentionedUserIds: mentioned } : {}),
    },
    daysAgo: c.daysAgo,
  }
})

/** A milestone once a measure draws 4+ member votes, dated to the newest of them. */
const voteMilestones: DemoSeedFeedEvent[] = Object.entries(
  DCYJ_VOTES.reduce<Record<string, typeof DCYJ_VOTES>>((acc, v) => {
    (acc[v.externalId] ??= []).push(v)
    return acc
  }, {}),
)
  .filter(([, vs]) => vs.length >= 4)
  .map(([externalId, vs]) => {
    const newest = vs.reduce((a, b) => (a.daysAgo <= b.daysAgo ? a : b))
    return {
      id: `dcyj-fe-v-${parseHandle(externalId)}`,
      type: 'vote_milestone' as const,
      externalId,
      userId: newest.userId,
      metadata: { message: `${vs.length} members have voted on this bill` },
      daysAgo: newest.daysAgo,
    }
  })

export const DC_YOUTH_JUSTICE_SEED: DemoSeed = {
  slug: 'dc-youth-justice',
  ...DCYJ_ORG,
  users: DCYJ_USERS, roles: DCYJ_ROLES, userRoles: DCYJ_USER_ROLES, customFields: DCYJ_CUSTOM_FIELDS,
  priorities: DCYJ_BILLS.map(b => ({ externalId: b.externalId, priority: b.priority })),
  positions: DCYJ_POSITIONS, votes: DCYJ_VOTES,
  comments: DCYJ_COMMENTS, reactions: DCYJ_REACTIONS, mentions: DCYJ_MENTIONS,
  feedEvents: [
    ...DCYJ_BILL_UPDATED_EVENTS, ...DCYJ_HEARING_EVENTS,
    ...priorityEvents, ...positionEvents, ...commentEvents, ...voteMilestones,
  ],
  customFieldValues: DCYJ_CUSTOM_FIELD_VALUES, notes: DCYJ_NOTES,
  calendarEvents: DCYJ_CALENDAR_EVENTS,
  teamFieldChanges: [],
  // Written for a youth-justice coalition. The first is the one OR view: the
  // DYRS and detention tags, or anything Youth Affairs leads. The tags are the
  // ones copied from OCA's analysis, so its count can drift when OCA's tags do;
  // the other two lean only on what this seed writes. Counts are for the 20 bills
  // in bills.ts, with the tags api/test/oca/index.ts records.
  savedViews: [
    {
      // 11 bills: 6 tagged DYRS, 4 tagged Pretrial & Detention, and B26-0479, which Youth Affairs leads.
      id: 'dcyj-view-dyrs-detention', name: 'DYRS, detention, or Youth Affairs', slug: 'dyrs-detention-or-youth-affairs',
      query: viewQuery([
        ['match', 'any'], ['tag', 'DYRS'], ['tag', 'Pretrial & Detention'], ['field.lead-committee', 'Youth Affairs'],
      ]),
    },
    {
      // 6 bills: the two curfew emergencies, B26-0461, B26-0671, B26-0401, and B26-0402.
      id: 'dcyj-view-pushing-back', name: 'Amend or oppose, high or medium priority', slug: 'amend-or-oppose-high-or-medium',
      query: viewQuery([['position', 'Amend'], ['position', 'Oppose'], ['priority', 'high'], ['priority', 'medium']]),
    },
    {
      // 2 bills: the hearing notices HN26-0083 (Youth Services Center overcrowding) and HN26-0163 (DYRS placement rules).
      id: 'dcyj-view-high-open', name: 'High priority, no position yet', slug: 'high-priority-no-position',
      query: viewQuery([['priority', 'high'], ['position', 'none']]),
    },
  ],
}
