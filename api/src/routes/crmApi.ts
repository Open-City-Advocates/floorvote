import { Hono } from 'hono'
import { and, asc, desc, eq, inArray, isNull, sql } from 'drizzle-orm'
import { requireAuth } from '../middleware/auth'
import { getDb } from '../db/client'
import { bills, crmContacts, crmFollowups, crmPeople, users } from '../db/schema'
import { activeUser } from '../lib/accountDeletion'
import { nowDb } from '../lib/dbTime'
import { CONTACT_KINDS, isPersonKey, type ContactKind } from '../../../shared/crmKeys'
import type { AppEnv } from '../types'

/**
 * A light CRM for the Council: for each Councilmember's office and each Council
 * staffer, a contact log, follow-ups, the team member who holds the
 * relationship, and stance notes. Any member may add entries; an entry's author
 * or an admin may change or delete it. The profile (owner, stance) is shared, so
 * any member may edit it. None of this goes to the deep-analysis worker.
 */
export const crmRouter = new Hono<AppEnv>()
crmRouter.use('*', requireAuth)

const MAX_SUMMARY = 4000
const MAX_STANCE = 4000
const MAX_FOLLOWUP = 500
const MAX_NAME = 200
const DAY = /^\d{4}-\d{2}-\d{2}$/

type Db = ReturnType<typeof getDb>
type User = { id: string; role: string }
const isAdmin = (u: User) => u.role === 'admin' || u.role === 'owner'

function text(v: unknown, max: number): string {
  return typeof v === 'string' ? v.trim().slice(0, max) : ''
}

function day(v: unknown): string | null {
  return typeof v === 'string' && DAY.test(v) && !Number.isNaN(Date.parse(`${v}T00:00:00Z`)) ? v : null
}

async function activeUserId(db: Db, v: unknown): Promise<string | null | undefined> {
  if (v === null || v === '') return null
  if (typeof v !== 'string') return undefined
  const row = await db.select({ id: users.id }).from(users).where(and(eq(users.id, v), activeUser)).get()
  return row ? row.id : undefined
}

/** The person's row, created from the name and office the page shows when it has none yet. */
async function ensurePerson(db: Db, key: string, body: Record<string, unknown>, userId: string): Promise<boolean> {
  const existing = await db.select({ key: crmPeople.personKey }).from(crmPeople).where(eq(crmPeople.personKey, key)).get()
  if (existing) return true
  const name = text(body.name, MAX_NAME)
  if (!name) return false
  await db.insert(crmPeople).values({ personKey: key, name, office: text(body.office, MAX_NAME) || null, updatedBy: userId, updatedAt: nowDb() })
    .onConflictDoNothing()
  return true
}

async function namesOf(db: Db, ids: (string | null)[]): Promise<Map<string, string>> {
  const want = [...new Set(ids.filter((id): id is string => !!id))]
  if (want.length === 0) return new Map()
  const rows = await db.select({ id: users.id, name: users.name }).from(users).where(inArray(users.id, want)).all()
  return new Map(rows.map(r => [r.id, r.name ?? '']))
}

// GET /crm/people: one line per person with a record, for the People page.
crmRouter.get('/people', async (c) => {
  const db = getDb(c.env.DB)
  const people = await db.select().from(crmPeople).all()
  const last = await db.select({ key: crmContacts.personKey, last: sql<string>`max(${crmContacts.contactDate})` })
    .from(crmContacts).groupBy(crmContacts.personKey).all()
  const open = await db.select({ key: crmFollowups.personKey, n: sql<number>`count(*)` })
    .from(crmFollowups).where(isNull(crmFollowups.doneAt)).groupBy(crmFollowups.personKey).all()
  const lastBy = new Map(last.map(r => [r.key, r.last]))
  const openBy = new Map(open.map(r => [r.key, Number(r.n)]))
  const names = await namesOf(db, people.map(p => p.ownerId))
  return c.json({
    people: people.map(p => ({
      personKey: p.personKey, name: p.name, office: p.office,
      owner: p.ownerId ? { id: p.ownerId, name: names.get(p.ownerId) ?? '' } : null,
      lastContact: lastBy.get(p.personKey) ?? null, openFollowups: openBy.get(p.personKey) ?? 0,
    })),
  })
})

// GET /crm/followups?scope=mine|all: open follow-ups, soonest due first.
crmRouter.get('/followups', async (c) => {
  const db = getDb(c.env.DB)
  const me = c.get('user').id
  const rows = await db.select({ f: crmFollowups, personName: crmPeople.name, office: crmPeople.office })
    .from(crmFollowups).innerJoin(crmPeople, eq(crmPeople.personKey, crmFollowups.personKey))
    .where(c.req.query('scope') === 'mine'
      ? and(isNull(crmFollowups.doneAt), eq(crmFollowups.ownerId, me))
      : isNull(crmFollowups.doneAt))
    .orderBy(sql`${crmFollowups.dueDate} IS NULL`, asc(crmFollowups.dueDate), asc(crmFollowups.createdAt)).all()
  const names = await namesOf(db, rows.map(r => r.f.ownerId))
  return c.json({
    followups: rows.map(r => ({
      id: r.f.id, personKey: r.f.personKey, personName: r.personName, office: r.office,
      dueDate: r.f.dueDate, text: r.f.text, owner: r.f.ownerId ? { id: r.f.ownerId, name: names.get(r.f.ownerId) ?? '' } : null,
    })),
  })
})

// GET /crm/people/:key: the full record.
crmRouter.get('/people/:key', async (c) => {
  const key = c.req.param('key')
  if (!isPersonKey(key)) return c.json({ error: 'Not found' }, 404)
  const db = getDb(c.env.DB)
  const person = await db.select().from(crmPeople).where(eq(crmPeople.personKey, key)).get()
  const contacts = await db.select({ c: crmContacts, billNumber: bills.billNumber })
    .from(crmContacts).leftJoin(bills, eq(bills.id, crmContacts.billId))
    .where(eq(crmContacts.personKey, key)).orderBy(desc(crmContacts.contactDate), desc(crmContacts.createdAt)).all()
  const followups = await db.select().from(crmFollowups).where(eq(crmFollowups.personKey, key))
    .orderBy(sql`${crmFollowups.doneAt} IS NOT NULL`, sql`${crmFollowups.dueDate} IS NULL`, asc(crmFollowups.dueDate), desc(crmFollowups.doneAt)).all()
  const names = await namesOf(db, [person?.ownerId ?? null, person?.updatedBy ?? null,
    ...contacts.map(r => r.c.authorId), ...followups.flatMap(f => [f.ownerId, f.authorId, f.doneBy])])
  const ref = (id: string | null) => id ? { id, name: names.get(id) ?? '' } : null
  return c.json({
    person: person ? {
      personKey: person.personKey, name: person.name, office: person.office, owner: ref(person.ownerId),
      stance: person.stance, updatedBy: ref(person.updatedBy), updatedAt: person.updatedAt,
    } : null,
    contacts: contacts.map(r => ({
      id: r.c.id, date: r.c.contactDate, kind: r.c.kind, summary: r.c.summary,
      bill: r.c.billId && r.billNumber ? { id: r.c.billId, number: r.billNumber } : null,
      author: ref(r.c.authorId), createdAt: r.c.createdAt, updatedAt: r.c.updatedAt,
    })),
    followups: followups.map(f => ({
      id: f.id, dueDate: f.dueDate, text: f.text, owner: ref(f.ownerId), author: ref(f.authorId),
      doneAt: f.doneAt, doneBy: ref(f.doneBy), createdAt: f.createdAt,
    })),
  })
})

// PUT /crm/people/:key: the shared profile (relationship owner, stance notes).
crmRouter.put('/people/:key', async (c) => {
  const key = c.req.param('key')
  if (!isPersonKey(key)) return c.json({ error: 'Not found' }, 404)
  const body = await c.req.json<Record<string, unknown>>().catch(() => ({} as Record<string, unknown>))
  const db = getDb(c.env.DB)
  const user = c.get('user')
  if (!await ensurePerson(db, key, body, user.id)) return c.json({ error: 'Name the person.' }, 400)
  const set: Partial<typeof crmPeople.$inferInsert> = { updatedBy: user.id, updatedAt: nowDb() }
  if ('ownerId' in body) {
    const ownerId = await activeUserId(db, body.ownerId)
    if (ownerId === undefined) return c.json({ error: 'Pick a current team member.' }, 400)
    set.ownerId = ownerId
  }
  if ('stance' in body) set.stance = text(body.stance, MAX_STANCE) || null
  await db.update(crmPeople).set(set).where(eq(crmPeople.personKey, key))
  return c.json({ ok: true })
})

async function contactFields(db: Db, body: Record<string, unknown>): Promise<{ contactDate: string; kind: ContactKind; summary: string; billId: string | null } | string> {
  const contactDate = day(body.date)
  if (!contactDate) return 'Give the date as YYYY-MM-DD.'
  const kind = body.kind
  if (typeof kind !== 'string' || !(CONTACT_KINDS as readonly string[]).includes(kind)) return 'Pick what kind of contact it was.'
  const summary = text(body.summary, MAX_SUMMARY)
  if (!summary) return 'Say briefly what happened.'
  let billId: string | null = null
  if (typeof body.billId === 'string' && body.billId) {
    const bill = await db.select({ id: bills.id }).from(bills).where(eq(bills.id, body.billId)).get()
    if (!bill) return 'That bill is not tracked here.'
    billId = bill.id
  }
  return { contactDate, kind: kind as ContactKind, summary, billId }
}

// POST /crm/people/:key/contacts
crmRouter.post('/people/:key/contacts', async (c) => {
  const key = c.req.param('key')
  if (!isPersonKey(key)) return c.json({ error: 'Not found' }, 404)
  const body = await c.req.json<Record<string, unknown>>().catch(() => ({} as Record<string, unknown>))
  const db = getDb(c.env.DB)
  const user = c.get('user')
  const fields = await contactFields(db, body)
  if (typeof fields === 'string') return c.json({ error: fields }, 400)
  if (!await ensurePerson(db, key, body, user.id)) return c.json({ error: 'Name the person.' }, 400)
  const id = crypto.randomUUID()
  await db.insert(crmContacts).values({ id, personKey: key, ...fields, authorId: user.id })
  return c.json({ id }, 201)
})

async function ownContact(db: Db, id: string, user: User) {
  const row = await db.select().from(crmContacts).where(eq(crmContacts.id, id)).get()
  if (!row) return { status: 404 as const }
  if (row.authorId !== user.id && !isAdmin(user)) return { status: 403 as const }
  return { status: 200 as const, row }
}

crmRouter.patch('/contacts/:id', async (c) => {
  const db = getDb(c.env.DB)
  const found = await ownContact(db, c.req.param('id'), c.get('user'))
  if (found.status !== 200) return c.json({ error: found.status === 404 ? 'Not found' : 'Only the author or an admin can change this.' }, found.status)
  const body = await c.req.json<Record<string, unknown>>().catch(() => ({} as Record<string, unknown>))
  const fields = await contactFields(db, {
    date: body.date ?? found.row.contactDate, kind: body.kind ?? found.row.kind,
    summary: body.summary ?? found.row.summary, billId: 'billId' in body ? body.billId : found.row.billId,
  })
  if (typeof fields === 'string') return c.json({ error: fields }, 400)
  await db.update(crmContacts).set({ ...fields, updatedAt: nowDb() }).where(eq(crmContacts.id, found.row.id))
  return c.json({ ok: true })
})

crmRouter.delete('/contacts/:id', async (c) => {
  const db = getDb(c.env.DB)
  const found = await ownContact(db, c.req.param('id'), c.get('user'))
  if (found.status !== 200) return c.json({ error: found.status === 404 ? 'Not found' : 'Only the author or an admin can delete this.' }, found.status)
  await db.delete(crmContacts).where(eq(crmContacts.id, found.row.id))
  return c.body(null, 204)
})

// POST /crm/people/:key/followups
crmRouter.post('/people/:key/followups', async (c) => {
  const key = c.req.param('key')
  if (!isPersonKey(key)) return c.json({ error: 'Not found' }, 404)
  const body = await c.req.json<Record<string, unknown>>().catch(() => ({} as Record<string, unknown>))
  const db = getDb(c.env.DB)
  const user = c.get('user')
  const followText = text(body.text, MAX_FOLLOWUP)
  if (!followText) return c.json({ error: 'Say what needs doing.' }, 400)
  const dueDate = body.dueDate ? day(body.dueDate) : null
  if (body.dueDate && !dueDate) return c.json({ error: 'Give the due date as YYYY-MM-DD.' }, 400)
  const ownerId = 'ownerId' in body ? await activeUserId(db, body.ownerId) : user.id
  if (ownerId === undefined) return c.json({ error: 'Pick a current team member.' }, 400)
  if (!await ensurePerson(db, key, body, user.id)) return c.json({ error: 'Name the person.' }, 400)
  const id = crypto.randomUUID()
  await db.insert(crmFollowups).values({ id, personKey: key, dueDate, text: followText, ownerId, authorId: user.id })
  return c.json({ id }, 201)
})

// PATCH /crm/followups/:id: mark done or reopen (author, owner, or admin), or edit (author or admin).
crmRouter.patch('/followups/:id', async (c) => {
  const db = getDb(c.env.DB)
  const user = c.get('user')
  const row = await db.select().from(crmFollowups).where(eq(crmFollowups.id, c.req.param('id'))).get()
  if (!row) return c.json({ error: 'Not found' }, 404)
  const body = await c.req.json<Record<string, unknown>>().catch(() => ({} as Record<string, unknown>))
  const canEdit = row.authorId === user.id || isAdmin(user)
  const set: Partial<typeof crmFollowups.$inferInsert> = {}
  if ('done' in body) {
    if (!canEdit && row.ownerId !== user.id) return c.json({ error: 'Only the author, the owner, or an admin can close this.' }, 403)
    set.doneAt = body.done ? nowDb() : null
    set.doneBy = body.done ? user.id : null
  }
  if ('text' in body || 'dueDate' in body || 'ownerId' in body) {
    if (!canEdit) return c.json({ error: 'Only the author or an admin can change this.' }, 403)
    if ('text' in body) {
      const t = text(body.text, MAX_FOLLOWUP)
      if (!t) return c.json({ error: 'Say what needs doing.' }, 400)
      set.text = t
    }
    if ('dueDate' in body) {
      const d = body.dueDate ? day(body.dueDate) : null
      if (body.dueDate && !d) return c.json({ error: 'Give the due date as YYYY-MM-DD.' }, 400)
      set.dueDate = d
    }
    if ('ownerId' in body) {
      const ownerId = await activeUserId(db, body.ownerId)
      if (ownerId === undefined) return c.json({ error: 'Pick a current team member.' }, 400)
      set.ownerId = ownerId
    }
  }
  if (Object.keys(set).length > 0) await db.update(crmFollowups).set(set).where(eq(crmFollowups.id, row.id))
  return c.json({ ok: true })
})

crmRouter.delete('/followups/:id', async (c) => {
  const db = getDb(c.env.DB)
  const user = c.get('user')
  const row = await db.select().from(crmFollowups).where(eq(crmFollowups.id, c.req.param('id'))).get()
  if (!row) return c.json({ error: 'Not found' }, 404)
  if (row.authorId !== user.id && !isAdmin(user)) return c.json({ error: 'Only the author or an admin can delete this.' }, 403)
  await db.delete(crmFollowups).where(eq(crmFollowups.id, row.id))
  return c.body(null, 204)
})
