// The notifications inbox: one stored row per event a member is notified about.
//
// Each kind has a writer and a renderer. The writer stores rows when the event
// happens (mentions: lib/mentions.ts, through writeNotifications below). The
// renderer turns a stored row into the API shape GET /notifications returns,
// discriminated on `kind`. Adding a kind means adding it to the schema's `kind`
// enum, a writer, and a renderer here, and a renderer in the web panel.
//
// Notifications for deleted comments are hidden here, at read time, rather than
// deleted when the comment is.
import { and, desc, eq, inArray, isNull } from 'drizzle-orm'
import type { getDb } from '../db/client'
import { notifications, comments, users, bills, roles, type MentionNotificationData, type NotificationKind } from '../db/schema'
import { filedSlug } from './sessionSlug'
import { stripHtml } from './mentions'
import { nowDb } from './dbTime'
import { activeUser } from './accountDeletion'
import { userDisplayNameSql } from './displayName'

type Db = ReturnType<typeof getDb>

export type NewNotification = {
  recipientId: string
  kind: NotificationKind
  billId: string
  commentId: string
  actorId: string
  /** Kind-specific data, stored as JSON. */
  data: MentionNotificationData
}

// D1 rejects a statement with more than 100 bound parameters, and each row binds
// seven, so an @everyone on a larger instance has to be split.
const INSERT_CHUNK = 14

/**
 * Stores notifications. A row its kind already has (a mention is unique per
 * comment and recipient) is skipped rather than duplicated, which is what keeps
 * two concurrent edits of one comment from notifying a person twice.
 *
 * Returns the ids of the recipients actually written, so a caller emails only them.
 */
export async function writeNotifications(db: Db, rows: NewNotification[]): Promise<Set<string>> {
  const written = new Set<string>()
  if (rows.length === 0) return written
  const statements = []
  for (let i = 0; i < rows.length; i += INSERT_CHUNK) {
    statements.push(db.insert(notifications)
      .values(rows.slice(i, i + INSERT_CHUNK).map(r => ({
        id: crypto.randomUUID(),
        recipientId: r.recipientId,
        kind: r.kind,
        billId: r.billId,
        commentId: r.commentId,
        actorId: r.actorId,
        data: JSON.stringify(r.data),
      })))
      .onConflictDoNothing()
      .returning({ recipientId: notifications.recipientId }))
  }
  const results = await db.batch(statements as unknown as Parameters<typeof db.batch>[0]) as unknown as Array<Array<{ recipientId: string }>>
  for (const result of results) for (const r of result) written.add(r.recipientId)
  return written
}

/** Reads a mention row's data. Rows are written by this module, so the shape is trusted. */
export function mentionData(data: string): MentionNotificationData {
  return JSON.parse(data) as MentionNotificationData
}

/** Shared by every kind: where the notification points, and whether it's been read. */
type NotificationBase = {
  id: string
  commentId: string
  billId: string
  billNumber: string
  billTitle: string
  billState: string | null
  /** Drives the dashed BillBadge variant on the row's bill footer. A draft is
   *  fully commentable, so a notification on one is an ordinary case. */
  billIsDraft: boolean
  sessionSlug: string | null
  createdAt: string
  isUnread: boolean
}

export type MentionNotificationView = NotificationBase & {
  kind: 'mention'
  authorId: string
  authorName: string | null
  authorSubtitle: string | null
  commentPreview: string
  commentHtml: string
  sourceType: MentionNotificationData['sourceType']
  sourceLabel: string | null
}

export type NotificationView = MentionNotificationView

const LIST_LIMIT = 50

/**
 * A member's newest notifications, rendered for GET /notifications. The unread
 * count covers the rows returned.
 */
export async function listNotifications(db: Db, recipientId: string): Promise<{ unreadCount: number; notifications: NotificationView[] }> {
  const rows = await db
    .select({
      id: notifications.id,
      kind: notifications.kind,
      commentId: notifications.commentId,
      data: notifications.data,
      readAt: notifications.readAt,
      createdAt: notifications.createdAt,
      commentContent: comments.content,
      actorId: users.id,
      actorName: userDisplayNameSql,
      actorSubtitle: users.subtitle,
      billId: bills.id,
      billNumber: bills.billNumber,
      billTitle: bills.title,
      billAbstract: bills.abstract,
      billState: bills.state,
      billSession: bills.session,
      billSessionSlug: bills.sessionSlug,
      billIsDraft: bills.isDraft,
    })
    .from(notifications)
    .innerJoin(comments, eq(notifications.commentId, comments.id))
    .innerJoin(users, eq(notifications.actorId, users.id))
    .innerJoin(bills, eq(notifications.billId, bills.id))
    .where(and(eq(notifications.recipientId, recipientId), isNull(comments.deletedAt), activeUser))
    .orderBy(desc(notifications.createdAt))
    .limit(LIST_LIMIT)
    .all()

  // Role names for role mentions, looked up once for the whole page.
  const roleIds = [...new Set(rows
    .filter(r => r.kind === 'mention')
    .map(r => mentionData(r.data))
    .filter(d => d.sourceType === 'role')
    .map(d => d.sourceId))]
  const roleNames = new Map<string, string>()
  if (roleIds.length > 0) {
    const roleRows = await db.select({ id: roles.id, name: roles.name }).from(roles).where(inArray(roles.id, roleIds)).all()
    for (const r of roleRows) roleNames.set(r.id, r.name)
  }

  const rendered = rows.map((r): NotificationView => {
    const base: NotificationBase = {
      id: r.id,
      commentId: r.commentId,
      billId: r.billId,
      billNumber: r.billNumber,
      billTitle: r.billAbstract ?? r.billTitle,
      billState: r.billState,
      billIsDraft: r.billIsDraft,
      sessionSlug: filedSlug({ session: r.billSession, sessionSlug: r.billSessionSlug }),
      createdAt: r.createdAt,
      isUnread: r.readAt === null,
    }
    switch (r.kind) {
      case 'mention': {
        const data = mentionData(r.data)
        return {
          ...base,
          kind: 'mention',
          authorId: r.actorId,
          authorName: r.actorName,
          authorSubtitle: r.actorSubtitle,
          commentPreview: stripHtml(r.commentContent).slice(0, 150),
          commentHtml: r.commentContent,
          sourceType: data.sourceType,
          sourceLabel: data.sourceType === 'role' ? (roleNames.get(data.sourceId) ?? null) : null,
        }
      }
    }
  })

  return {
    unreadCount: rendered.filter(n => n.isUnread).length,
    notifications: rendered,
  }
}

/** Marks every unread notification of the member's read (the panel opened). */
export async function markAllRead(db: Db, recipientId: string): Promise<void> {
  await db.update(notifications)
    .set({ readAt: nowDb() })
    .where(and(eq(notifications.recipientId, recipientId), isNull(notifications.readAt)))
}

/** Marks the member's notifications about one comment read. */
export async function markCommentRead(db: Db, recipientId: string, commentId: string): Promise<void> {
  await db.update(notifications)
    .set({ readAt: nowDb() })
    .where(and(eq(notifications.recipientId, recipientId), eq(notifications.commentId, commentId), isNull(notifications.readAt)))
}

/** Marks the member's notifications about one bill read (its page opened). */
export async function markBillRead(db: Db, recipientId: string, billId: string): Promise<void> {
  await db.update(notifications)
    .set({ readAt: nowDb() })
    .where(and(eq(notifications.recipientId, recipientId), eq(notifications.billId, billId), isNull(notifications.readAt)))
}
