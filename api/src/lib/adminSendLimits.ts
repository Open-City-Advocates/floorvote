import { and, eq, gt, isNotNull, sql, type SQL } from 'drizzle-orm'
import type { AppDb } from '../types'
import { authEvents } from '../db/schema'

// Limits on the admin routes that email a member: resend invite, resend
// sign-in link, and change a pending invite's address. The limits live here
// and nowhere else.
//
// Counted from auth_events, not a Workers Rate Limiting binding. That binding
// can only count over 10 or 60 seconds, which cannot say "a few resends an
// hour", and without the binding declared (an upgrade step for every
// self-hoster) it fails open, which would leave these routes unprotected.
// Every send already records a link_requested row, so the count needs no new
// table. Routes record the admin as the row's actor_id, which is also how
// admin sends are told apart from a member's own sign-in requests.
//
// Both limits are counted over a sliding window, shared by all three routes: an
// inbox is flooded the same way whichever route filled it. Only sends that
// went out count, so a request refused for a bad address or by a limit uses
// none of the allowance.
//
// To limit a new kind of send (e.g. a member changing their own address), reuse
// countRecentSends with its own limits rather than adding another counter.

export interface SendLimit {
  /** The most sends allowed in the window. The one after it is refused. */
  max: number
  windowMinutes: number
}

export const ADMIN_SEND_LIMITS = {
  // One member's inbox, from every admin together. Sized to the sign-in form's
  // cap of five active links: enough to resend a couple of times and fix a
  // typo, not enough to pile mail onto one address.
  perMember: { max: 5, windowMinutes: 60 } satisfies SendLimit,
  // One admin's sends across all members. Leaves room for working through a
  // long list of pending invites in one sitting, while a stolen or runaway
  // session stops at a few dozen messages rather than thousands.
  perAdmin: { max: 50, windowMinutes: 60 } satisfies SendLimit,
}

export const ADMIN_SEND_LIMIT_MESSAGES = {
  perMember: 'This member was sent several invites or sign-in links in the past hour. Ask them to check their spam folder, or try again in a little while.',
  perAdmin: "You've sent a lot of invites and sign-in links in the past hour. Please wait a little while before sending more.",
} as const

/**
 * Sends recorded for `who` inside `limit`'s window. Counts link_requested rows
 * that an admin caused (actor_id set), either by `actorId` or to `memberId`.
 */
export async function countRecentSends(
  db: AppDb,
  who: { actorId: string } | { memberId: string },
  limit: SendLimit,
): Promise<number> {
  const scope: SQL = 'actorId' in who
    ? eq(authEvents.actorId, who.actorId)
    : and(eq(authEvents.userId, who.memberId), isNotNull(authEvents.actorId))!
  const [row] = await db
    .select({ n: sql<number>`count(*)` })
    .from(authEvents)
    .where(and(
      eq(authEvents.event, 'link_requested'),
      scope,
      gt(authEvents.createdAt, sql`datetime('now', ${`-${limit.windowMinutes} minutes`})`),
    ))
  return row?.n ?? 0
}

/**
 * The message to refuse an admin's send with (a 429), or null when it may go
 * ahead. The admin's own limit is checked first.
 */
export async function adminSendLimitMessage(db: AppDb, adminId: string, memberId: string): Promise<string | null> {
  if (await countRecentSends(db, { actorId: adminId }, ADMIN_SEND_LIMITS.perAdmin) >= ADMIN_SEND_LIMITS.perAdmin.max) {
    return ADMIN_SEND_LIMIT_MESSAGES.perAdmin
  }
  if (await countRecentSends(db, { memberId }, ADMIN_SEND_LIMITS.perMember) >= ADMIN_SEND_LIMITS.perMember.max) {
    return ADMIN_SEND_LIMIT_MESSAGES.perMember
  }
  return null
}
