import { Hono } from 'hono'
import { and, desc, eq, gte } from 'drizzle-orm'
import { secretsMatch } from '../lib/auth'
import { drizzle } from 'drizzle-orm/d1'
import * as schema from '../db/schema'
import { sessions } from '../db/schema'
import { councilChanges, councilCommittees, councilDirectory, councilPeople } from './schema'
import { isCurrentMember, periodMembers, seatNote } from './council-changes'
import { runDcDirectory } from './directory'
import type { Env } from '../types'

/**
 * The fork's central routes. Mounted ahead of upstream's (`/api/bills/:id`
 * would otherwise answer for /council-directory), behind the same admin secret.
 * Instances reach /council-directory through TenantApi, whose allowlist
 * already passes it under `GET /api/bills/:id`.
 */
export const ocaBillsRoutes = new Hono<{ Bindings: Env }>()
export const ocaAdminRoutes = new Hono<{ Bindings: Env }>()

for (const routes of [ocaBillsRoutes, ocaAdminRoutes]) {
  routes.use('*', async (c, next) => {
    if (!(await secretsMatch(c.req.header('x-admin-secret'), c.env.ADMIN_SECRET))) return c.json({ error: 'unauthorized' }, 401)
    return next()
  })
}

ocaBillsRoutes.get('/council-directory', async (c) => {
  const db = drizzle(c.env.DB, { schema })
  const parse = <T>(s: string | null, fallback: T): T => { if (!s) return fallback; try { return JSON.parse(s) as T } catch { return fallback } }
  const committees = await db.select().from(councilCommittees).orderBy(councilCommittees.name).all()
  const people = await db.select().from(councilDirectory).orderBy(councilDirectory.name).all()
  // The current Council Period's members with their terms, so a page or a brief
  // can tell a sitting member from one who has left.
  const today = new Date().toISOString().slice(0, 10)
  const period = await db.select({ yearStart: sessions.yearStart }).from(sessions)
    .where(and(eq(sessions.state, 'DC'), eq(sessions.provider, 'lims'), eq(sessions.prior, 0))).get()
  const members = await db.select({ peopleId: councilPeople.peopleId, name: councilPeople.name, role: councilPeople.role, termStart: councilPeople.termStart, termEnd: councilPeople.termEnd, seated: councilPeople.seated })
    .from(councilPeople).where(eq(councilPeople.provider, 'lims')).all()
  const councilmembers = periodMembers(members, period?.yearStart ?? null)
    .map(({ seated, ...m }) => ({ ...m, current: isCurrentMember({ ...m, seated }, today), note: seatNote({ ...m, seated }, today) }))
    .sort((a, b) => Number(b.current) - Number(a.current) || a.name.localeCompare(b.name))
  const changes = await db.select().from(councilChanges)
    .where(gte(councilChanges.detectedAt, new Date(Date.now() - 180 * 86_400_000).toISOString().slice(0, 10)))
    .orderBy(desc(councilChanges.detectedAt), desc(councilChanges.id)).limit(100).all()
  return c.json({
    councilmembers,
    changes: changes.map(ch => ({ kind: ch.kind, committee: ch.committee, person: ch.person, detail: ch.detail, detectedAt: ch.detectedAt })),
    committees: committees.map(r => ({
      slug: r.slug, name: r.name, url: r.url,
      chair: parse(r.chairJson, null), members: parse(r.membersJson, []), staff: parse(r.staffJson, []), agencies: parse(r.agenciesJson, []),
      updatedAt: r.updatedAt,
    })),
    people: people.map(r => ({ kind: r.kind, name: r.name, title: r.title, office: r.office, email: r.email, phone: r.phone })),
    updatedAt: committees[0]?.updatedAt ?? null,
  })
})

// Refresh the directory, seats, and terms now instead of at 5 ET.
ocaAdminRoutes.post('/dc-directory/sync', async (c) => {
  const report = await runDcDirectory(c.env, drizzle(c.env.DB, { schema }), { force: true })
  if (!report) return c.json({ error: 'LIMS is not configured, or doesn\'t hold DC here yet' }, 400)
  return c.json({ ok: true, ...report })
})
