import { Hono } from 'hono'
import { requireAuth } from '../middleware/auth'
import { getDb } from '../db/client'
import { listNotifications, markAllRead, markCommentRead, markBillRead } from '../lib/notifications'
import type { AppEnv } from '../types'

export const notificationsRouter = new Hono<AppEnv>()
notificationsRouter.use('*', requireAuth)

notificationsRouter.get('/', async (c) => {
  return c.json(await listNotifications(getDb(c.env.DB), c.get('user').id))
})

notificationsRouter.post('/mark-read', async (c) => {
  await markAllRead(getDb(c.env.DB), c.get('user').id)
  return c.json({ ok: true })
})

notificationsRouter.post('/mark-read/:commentId', async (c) => {
  await markCommentRead(getDb(c.env.DB), c.get('user').id, c.req.param('commentId'))
  return c.json({ ok: true })
})

notificationsRouter.post('/mark-read-by-bill/:billId', async (c) => {
  await markBillRead(getDb(c.env.DB), c.get('user').id, c.req.param('billId'))
  return c.json({ ok: true })
})
