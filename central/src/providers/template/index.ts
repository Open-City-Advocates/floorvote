import { getTemplateSession, templateSessionExists, type TemplateRecord } from './client'
import { buildTemplateMeasure, TEMPLATE_STATE, templateNativeKey, templateRecordHash, toTemplateEntry } from './map'
import { vocabulary } from './vocabulary'
import type { Provider, ProviderRecord, SyncSession } from '../sdk'

/**
 * TEMPLATE: a starting point for a new provider, not a provider. It compiles
 * and passes lint behind the provider boundary, and it is not in the registry
 * (src/providers/index.ts), so central never runs it.
 *
 * To start a provider, copy this directory to src/providers/<id>/, and
 * test/providers/template/ and test/fixtures/template/ beside it, then
 * replace every TEMPLATE note. The guide is "Adding a data provider" on the
 * docs site (docs/content/contributing/providers.md).
 *
 * Provider code imports only ../sdk and its own directory, and core does
 * every read and write. This placeholder is a snapshot provider: the feed has
 * no modified-since filter, so each pass reads a session whole, and core
 * stores each changed record and hands it back for the ingest. A provider
 * whose API can list changes cheaply implements `listMeasures` and
 * `listChangeHashes` instead (see providers/legiscan/). The interface, and
 * what each optional member is for, is in src/providers/types.ts.
 */
export const template: Provider = {
  // TEMPLATE: a short, stable id. It is stored on every row the provider writes, so it never changes.
  id: 'template',
  // TEMPLATE: the publisher's name, such as "Maryland General Assembly". It titles the bill page's extras panel.
  displayName: 'Template Legislature',
  // TEMPLATE: the credit every instance covering your state shows in its footer, "Data: <name>". Name the publisher,
  // link its data page, and say in one sentence where the data comes from and on what terms. Add `license` (name and
  // URL) only when the publisher's license asks for credit. Instances need no setting and no web code for it.
  attribution: {
    name: 'Template Legislature',
    url: 'https://legislature.example.gov',
    note: 'Legislative data comes from the Template Legislature\'s public data feed.',
  },
  // TEMPLATE: who maintains the provider (GitHub handles, no @), and `experimental` until it has run through a
  // session. Say whether it supplies member votes and bill text. A test asserts both against your fixtures.
  // Keep CODEOWNERS' line for this directory in step. The State coverage page lists only registered providers.
  coverage: { maintainers: ['wtadler'], status: 'experimental', memberVotes: false, billText: false },
  // TEMPLATE: the env keys the provider reads, such as its API key, declared in central's Env type.
  // `ctx.env` holds these and nothing else. Add `configured` when the provider can't run without one.
  envKeys: [],
  states: [TEMPLATE_STATE],

  /** The sessions the feed has published for this year and next, one HEAD request each. */
  async listSessions(_state, ctx) {
    const year = Number(ctx.today.slice(0, 4))
    const codes: string[] = []
    for (const code of [String(year), String(year + 1)]) {
      if (await templateSessionExists(code, () => ctx.logCall('template:SessionExists', { session: code }))) codes.push(code)
    }
    const ids = await ctx.ids('session', codes)
    return codes.map((code): SyncSession => ({
      session_id: ids.get(code)!,
      session_name: `${code} Session`,
      year_start: Number(code),
      year_end: Number(code),
      session_tag: code,
      prior: 0,
      sine_die: 0,
    }))
  },

  /** This year's and next year's sessions. */
  selectSessions(sessions, today) {
    const year = Number(today.slice(0, 4))
    return sessions.filter(s => s.yearStart >= year)
  },

  async snapshot(session, ctx) {
    const code = session.sessionTag
    const rows = await getTemplateSession(code, () => ctx.logCall('template:Session', { session: code }))
    if (!rows) return { records: [] }
    const keys = rows.map(r => templateNativeKey(code, r.Number))
    const ids = await ctx.ids('bill', keys)
    const records = await Promise.all(rows.map(async (r, i): Promise<ProviderRecord> => ({
      billId: ids.get(keys[i])!,
      nativeKey: keys[i],
      raw: r,
      hash: await templateRecordHash(r),
    })))
    return { records }
  },

  async toEntry(record) {
    return toTemplateEntry(record.raw as TemplateRecord, record.billId, record.hash)
  },

  async fetchMeasure({ billId, sessionId, nativeKey, record, session }) {
    if (!record || !nativeKey || sessionId === null) throw new Error(`bill ${billId} has no stored template record`)
    const code = nativeKey.split('/')[0]
    return buildTemplateMeasure(record.raw as TemplateRecord, billId, record.hash, {
      session_id: sessionId,
      session_name: session?.sessionName ?? `${code} Session`,
      year_start: session?.yearStart ?? Number(code),
      year_end: session?.yearEnd ?? Number(code),
    })
  },

  vocabulary,
}
