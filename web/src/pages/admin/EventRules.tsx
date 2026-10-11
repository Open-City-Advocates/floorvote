import { useEffect, useMemo, useState } from 'react'
import { color, fontSize, fontWeight, radius } from '../../styles/tokens'
import { actionRowStyle, actionBtnBlue } from '../../styles/actionRow'
import { apiFetch, ApiError } from '../../lib/api'
import { CARD } from '../../lib/cardStyle'
import { CARD_TITLE, FORM_LABEL, HELPER_TEXT } from '../../lib/textStyles'
import { safeDate } from '../../lib/dates'
import { useHasBodyEvents } from '../../lib/capabilities'
import { SettingsNav } from '../../components/SettingsNav'
import { ResizableTextarea } from '../../components/ResizableTextarea'
import { useDemo } from '../../context/DemoContext'
import { useConfig } from '../../context/ConfigContext'
import { eventMatchesRules, type EventFacets, type EventRules as Rules } from '../../../../shared/eventRules'

interface Committee { committeeId: string; name: string; chamber: string | null; state: string | null }
interface Kind { kind: string; types: string[] }
interface PreviewEvent {
  id: string; date: string; time: string | null; description: string | null; url: string | null; facets: EventFacets
  trackedOnAgenda: boolean
  /** A prioritized bill is on the agenda, so the event shows whatever the rules say. */
  prioritizedOnAgenda: boolean
}
interface Loaded {
  rules: Rules | null
  hasBodyEvents: boolean
  committees: Committee[]
  kinds: Kind[]
  events: PreviewEvent[]
  optionsError: string | null
}

/**
 * Form state. Kinds and event types are kept apart, though the rules store
 * both in `kinds`, so a type named like a kind can't be mistaken for it. A
 * committee maps to '' (every event), 'kind:<kind>', or 'type:<event type>'.
 */
interface FormState {
  mode: 'all' | 'rules'
  committees: Map<string, string>
  kinds: Set<string>
  types: Set<string>
  topics: { name: string; keywords: string }[]
  trackedBills: boolean
}

const KIND_LABELS: Record<string, string> = { hearing: 'Hearings', markup: 'Markups', meeting: 'Meetings' }
const kindLabel = (kind: string) => KIND_LABELS[kind] ?? kind.charAt(0).toUpperCase() + kind.slice(1)

/** The kinds a rule value may name: central's and the events', and the generic ones. */
const kindNames = (kinds: Kind[]) => new Set([...Object.keys(KIND_LABELS), ...kinds.map(k => k.kind)])

function toForm(rules: Rules | null, kinds: Set<string>): FormState {
  const narrowing = (value: string | undefined) => value ? `${kinds.has(value) ? 'kind' : 'type'}:${value}` : ''
  return {
    mode: rules ? 'rules' : 'all',
    committees: new Map((rules?.committees ?? []).map(c => [c.committeeId, narrowing(c.kind)])),
    kinds: new Set((rules?.kinds ?? []).filter(k => kinds.has(k))),
    types: new Set((rules?.kinds ?? []).filter(k => !kinds.has(k))),
    topics: (rules?.topics ?? []).map(t => ({ name: t.name, keywords: t.keywords.join('\n') })),
    trackedBills: rules ? rules.trackedBills : true,
  }
}

function toRules(f: FormState, committees: Committee[]): Rules {
  return {
    committees: [...f.committees].map(([committeeId, narrowing]) => {
      const name = committees.find(c => c.committeeId === committeeId)?.name ?? committeeId
      const kind = narrowing.slice(narrowing.indexOf(':') + 1)
      return kind ? { committeeId, name, kind } : { committeeId, name }
    }),
    kinds: [...new Set([...f.kinds, ...f.types])],
    topics: f.topics
      .map(t => ({ name: t.name.trim(), keywords: t.keywords.split('\n').map(k => k.trim()).filter(Boolean) }))
      .filter(t => t.name || t.keywords.length > 0),
    trackedBills: f.trackedBills,
  }
}

const PAGE: React.CSSProperties = { padding: '24px 32px', maxWidth: 900, margin: '0 auto' }

/**
 * Settings → Calendar events (#298). Admins choose which body events, the
 * legislature's own calendar, reach the instance's calendar: by committee,
 * kind or event type, topic, or tracked bill. Offered only while a covered
 * state's provider publishes one. The lists come from central, the topics
 * are the instance's own, and the preview applies the same rules the
 * instance does (shared/eventRules.ts).
 */
export function EventRules() {
  const { demoLocked } = useDemo()
  const { loading: configLoading } = useConfig()
  const hasBodyEvents = useHasBodyEvents()
  const [loaded, setLoaded] = useState<Loaded | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [form, setForm] = useState<FormState>(() => toForm(null, kindNames([])))
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<{ text: string; error?: boolean } | null>(null)

  // Nothing to load while no covered state has body events: the page only says so.
  const offered = !configLoading && hasBodyEvents
  useEffect(() => {
    if (!offered) return
    apiFetch<Loaded>('/admin/event-rules')
      .then(d => { setLoaded(d); setForm(toForm(d.rules, kindNames(d.kinds))) })
      .catch(() => setLoadError('Could not load the calendar event settings.'))
  }, [offered])

  function edit(patch: Partial<FormState>) {
    setForm(f => ({ ...f, ...patch }))
    setMessage(null)
  }

  const rules = useMemo(() => loaded ? toRules(form, loaded.committees) : null, [form, loaded])
  const preview = useMemo(() => {
    if (!loaded || !rules) return []
    return form.mode === 'all' ? loaded.events : loaded.events.filter(e => eventMatchesRules(e.facets, rules, { tracked: e.trackedOnAgenda, prioritized: e.prioritizedOnAgenda }))
  }, [loaded, rules, form.mode])

  async function save() {
    if (!loaded) return
    const next = form.mode === 'all' ? null : toRules(form, loaded.committees)
    const blank = next?.topics.find(t => !t.name || t.keywords.length === 0)
    if (blank) {
      setMessage({ text: 'Each topic needs a name and at least one keyword.', error: true })
      return
    }
    setSaving(true)
    setMessage(null)
    try {
      const r = await apiFetch<{ rules: Rules | null; shown: number; hidden: number }>('/admin/event-rules', { method: 'PUT', body: JSON.stringify({ rules: next }) })
      setLoaded(l => l && { ...l, rules: r.rules })
      setMessage({
        text: r.rules
          ? `Saved. Your calendar shows ${r.shown} of ${r.shown + r.hidden} event${r.shown + r.hidden === 1 ? '' : 's'} from the legislature's calendar.`
          : 'Saved. Your calendar shows every event from the legislature\'s calendar.',
      })
    } catch (e) {
      setMessage({ text: e instanceof ApiError ? e.message : 'Save failed.', error: true })
    } finally {
      setSaving(false)
    }
  }

  const label: React.CSSProperties = FORM_LABEL
  const hint: React.CSSProperties = { ...HELPER_TEXT, marginTop: 4 }
  const checkRow: React.CSSProperties = { display: 'flex', alignItems: 'center', gap: 8, fontSize: fontSize.sm, color: color.textSlate, padding: '3px 0' }
  const grid: React.CSSProperties = { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', columnGap: 16 }
  const select: React.CSSProperties = { fontSize: fontSize.xs, padding: '1px 4px', borderRadius: radius.sm, border: `1px solid ${color.borderDefault}`, background: color.white, maxWidth: 170 }
  const input: React.CSSProperties = { fontSize: fontSize.sm, padding: '5px 8px', borderRadius: radius.md, border: `1px solid ${color.borderDefault}`, width: '100%', boxSizing: 'border-box', fontFamily: 'inherit' }
  const fieldset: React.CSSProperties = { border: 'none', padding: 0, margin: '0 0 20px' }
  const linkButton: React.CSSProperties = { background: 'none', border: 'none', padding: 0, fontSize: fontSize.sm, cursor: 'pointer' }
  const multiState = new Set((loaded?.committees ?? []).map(c => c.state).filter(Boolean)).size > 1
  const listedKinds = loaded?.kinds ?? []
  const listedTypes = [...new Set(listedKinds.flatMap(k => k.types))]

  return (
    <div style={PAGE}>
      <SettingsNav />
      {demoLocked && (
        <div style={{ fontSize: fontSize.sm, color: color.textSecondary, marginBottom: 16, padding: '8px 12px', background: color.surfaceSubtle, borderRadius: radius.md, border: `1px solid ${color.borderDefault}` }}>
          This is a demo instance — settings are read-only.
        </div>
      )}
      <div style={{ ...CARD, padding: 24 }}>
        <h1 style={CARD_TITLE}>Calendar events</h1>
        <div style={{ fontSize: fontSize.sm, color: color.textSecondary, lineHeight: 1.6, marginBottom: 20 }}>
          Your calendar includes the legislature's own calendar for the states you cover: hearings, roundtables, and meetings, including the ones with no bill attached. Choose which of them reach your calendar. Events update hourly. An event with a prioritized bill on its agenda always shows, and so do a prioritized bill's own hearings and deadlines.
        </div>

        {!configLoading && !hasBodyEvents ? (
          <div style={hint}>None of the states you cover has a legislative calendar FloorVote reads, so there's nothing to choose here yet.</div>
        ) : (
          <>
            {loadError && <div style={{ ...hint, color: color.textErrorRed }}>{loadError}</div>}
            {!loaded && !loadError && <div style={hint}>Loading…</div>}
            {loaded && (
              <>
                {loaded.optionsError && <div style={{ ...hint, marginBottom: 12, color: color.textAmberDark }}>{loaded.optionsError}</div>}
                <fieldset style={fieldset}>
                  <legend style={label}>Which events</legend>
                  <div style={checkRow}>
                    <input type="radio" id="er-all" name="er-mode" checked={form.mode === 'all'} onChange={() => edit({ mode: 'all' })} disabled={demoLocked} />
                    <label htmlFor="er-all">Every event</label>
                  </div>
                  <div style={checkRow}>
                    <input type="radio" id="er-rules" name="er-mode" checked={form.mode === 'rules'} onChange={() => edit({ mode: 'rules' })} disabled={demoLocked} />
                    <label htmlFor="er-rules">Only events matching any of the choices below</label>
                  </div>
                </fieldset>

                {form.mode === 'rules' && (
                  <>
                    <fieldset style={fieldset}>
                      <legend style={label}>Committees: every event they hold</legend>
                      {loaded.committees.length === 0 && <div style={hint}>No committees are listed yet.</div>}
                      <div style={grid}>
                        {loaded.committees.map((c, i) => {
                          const on = form.committees.has(c.committeeId)
                          const name = multiState && c.state ? `${c.name} (${c.state})` : c.name
                          return (
                            <div key={c.committeeId} style={checkRow}>
                              <input type="checkbox" id={`erc-${i}`} checked={on} disabled={demoLocked}
                                onChange={e => {
                                  const committees = new Map(form.committees)
                                  if (e.target.checked) committees.set(c.committeeId, '')
                                  else committees.delete(c.committeeId)
                                  edit({ committees })
                                }} />
                              <label htmlFor={`erc-${i}`} style={{ flex: 1 }}>{name}</label>
                              {on && listedKinds.length > 0 && (
                                <select aria-label={`Which ${c.name} events`} value={form.committees.get(c.committeeId) ?? ''} style={select} disabled={demoLocked}
                                  onChange={e => { const committees = new Map(form.committees); committees.set(c.committeeId, e.target.value); edit({ committees }) }}>
                                  <option value="">All events</option>
                                  <optgroup label="Kinds">
                                    {listedKinds.map(k => <option key={k.kind} value={`kind:${k.kind}`}>{kindLabel(k.kind)} only</option>)}
                                  </optgroup>
                                  {listedTypes.length > 0 && (
                                    <optgroup label="Event types">
                                      {listedTypes.map(t => <option key={t} value={`type:${t}`}>{t} only</option>)}
                                    </optgroup>
                                  )}
                                </select>
                              )}
                            </div>
                          )
                        })}
                      </div>
                    </fieldset>

                    <fieldset style={fieldset}>
                      <legend style={label}>Kinds: every event of the kind, whichever committee holds it</legend>
                      <div style={grid}>
                        {listedKinds.map((k, i) => (
                          <div key={k.kind} style={checkRow}>
                            <input type="checkbox" id={`erk-${i}`} checked={form.kinds.has(k.kind)} disabled={demoLocked}
                              onChange={e => { const kinds = new Set(form.kinds); if (e.target.checked) kinds.add(k.kind); else kinds.delete(k.kind); edit({ kinds }) }} />
                            <label htmlFor={`erk-${i}`}>All {kindLabel(k.kind).toLowerCase()}</label>
                          </div>
                        ))}
                      </div>
                    </fieldset>

                    <fieldset style={fieldset}>
                      <legend style={label}>Event types: the legislature's own names, whichever committee holds them</legend>
                      {listedKinds.filter(k => k.types.length > 0).map((k, i) => (
                        <div key={k.kind} style={{ marginBottom: 6 }}>
                          <div style={{ ...hint, marginTop: 0 }}>{kindLabel(k.kind)}</div>
                          <div style={grid}>
                            {k.types.map((t, j) => (
                              <div key={t} style={checkRow}>
                                <input type="checkbox" id={`ert-${i}-${j}`} checked={form.kinds.has(k.kind) || form.types.has(t)} disabled={demoLocked || form.kinds.has(k.kind)}
                                  onChange={e => { const types = new Set(form.types); if (e.target.checked) types.add(t); else types.delete(t); edit({ types }) }} />
                                <label htmlFor={`ert-${i}-${j}`}>{t}</label>
                              </div>
                            ))}
                          </div>
                        </div>
                      ))}
                    </fieldset>

                    <fieldset style={fieldset}>
                      <legend style={label}>Topics</legend>
                      <div style={{ ...hint, marginTop: 0, marginBottom: 8 }}>
                        Name each topic and list its keywords, one per line. They're matched against each event's title and agenda, where oversight and budget hearings name the agency: <code>department of corrections</code> catches that agency's hearings in any committee. Same syntax as bill keywords: add <code>*</code> to widen a word (<code>juvenile*</code>).
                      </div>
                      {form.topics.map((t, i) => (
                        <div key={i} style={{ border: `1px solid ${color.borderDefault}`, borderRadius: radius.lg, padding: 12, marginBottom: 8 }}>
                          <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 6 }}>
                            <input aria-label={`Topic ${i + 1} name`} value={t.name} placeholder="Topic name, e.g. Youth justice agencies" style={input} disabled={demoLocked}
                              onChange={e => edit({ topics: form.topics.map((x, j) => j === i ? { ...x, name: e.target.value } : x) })} />
                            <button type="button" className="blue-link" style={linkButton} disabled={demoLocked}
                              onClick={() => edit({ topics: form.topics.filter((_, j) => j !== i) })}>Remove</button>
                          </div>
                          <ResizableTextarea aria-label={`Topic ${i + 1} keywords`} value={t.keywords} initialHeight={90} minHeight={50}
                            style={{ fontFamily: 'monospace', fontSize: fontSize.sm }} disabled={demoLocked}
                            onChange={e => edit({ topics: form.topics.map((x, j) => j === i ? { ...x, keywords: e.target.value } : x) })} />
                        </div>
                      ))}
                      <button type="button" className="blue-link" style={linkButton} disabled={demoLocked}
                        onClick={() => edit({ topics: [...form.topics, { name: '', keywords: '' }] })}>Add a topic</button>
                    </fieldset>

                    <div style={checkRow}>
                      <input type="checkbox" id="er-tracked" checked={form.trackedBills} onChange={e => edit({ trackedBills: e.target.checked })} disabled={demoLocked} />
                      <label htmlFor="er-tracked">Any event whose agenda lists a bill we track</label>
                    </div>
                    <div style={hint}>The week-ahead email lists the events these choices select, and any with a prioritized bill on the agenda. A hidden event also drops out of your calendar feed.</div>
                  </>
                )}

                <div style={actionRowStyle}>
                  <button onClick={() => void save()} disabled={saving || demoLocked} style={actionBtnBlue(saving || demoLocked)}>
                    {saving ? 'Saving…' : 'Save'}
                  </button>
                  {message && <span role="status" style={{ fontSize: fontSize.sm, color: message.error ? color.textErrorRed : color.textSuccess, flexShrink: 1 }}>{message.text}</span>}
                </div>

                <div style={{ marginTop: 16, fontSize: fontSize.sm, color: color.textSlate }} data-testid="event-rules-preview">
                  <div style={{ fontWeight: fontWeight.medium, marginBottom: 6 }}>
                    {loaded.events.length === 0
                      ? 'No upcoming events on the legislature\'s calendar yet.'
                      : `${preview.length} of ${loaded.events.length} upcoming event${loaded.events.length === 1 ? '' : 's'} match${preview.length === 1 ? 'es' : ''}:`}
                  </div>
                  <ul style={{ margin: 0, paddingLeft: 18, lineHeight: 1.6 }}>
                    {preview.slice(0, 25).map(e => (
                      <li key={e.id}>
                        <span style={{ color: color.textMuted }}>{safeDate(e.date) ?? e.date}{e.time ? ` ${e.time}` : ''}</span>{' '}
                        {e.url ? <a href={e.url} target="_blank" rel="noopener noreferrer" className="blue-link">{e.description}</a> : e.description}
                        {form.mode === 'rules' && e.prioritizedOnAgenda && <span style={{ color: color.textMuted }}> (a prioritized bill is on the agenda)</span>}
                      </li>
                    ))}
                  </ul>
                  {preview.length > 25 && <div style={hint}>and {preview.length - 25} more</div>}
                </div>
              </>
            )}
          </>
        )}
      </div>
    </div>
  )
}
