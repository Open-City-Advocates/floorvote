import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { color, fontSize, fontWeight, radius } from '../styles/tokens'
import { usePageTitle } from '../hooks/usePageTitle'
import { useAuth } from '../hooks/useAuth'
import { useDemo } from '../context/DemoContext'
import { apiFetch, ApiError } from '../lib/api'
import { CARD } from '../lib/cardStyle'
import { SECTION_LABEL } from '../lib/textStyles'
import { CONTACT_KINDS, CONTACT_KIND_LABEL, councilmemberKey, staffKey, type ContactKind } from '../../../shared/crmKeys'
import { councilUrl, plainEmail } from './People'
import { todayIso } from '../lib/calendarGrid'

interface Ref { id: string; name: string }
interface Contact { id: string; date: string; kind: ContactKind; summary: string; bill: { id: string; number: string } | null; author: Ref | null; createdAt: string; updatedAt: string | null }
interface Followup { id: string; dueDate: string | null; text: string; owner: Ref | null; author: Ref | null; doneAt: string | null; doneBy: Ref | null }
interface Record_ {
  person: { personKey: string; name: string; office: string | null; owner: Ref | null; stance: string | null; updatedBy: Ref | null; updatedAt: string } | null
  contacts: Contact[]
  followups: Followup[]
}
interface Member { id: string; name: string | null }
interface BillOption { id: string; billNumber: string; title: string | null }

/** Who the directory says this is: name, title, office, contacts, committees. */
interface Identity { name: string; title: string | null; office: string | null; email: string | null; phone: string | null; url: string | null; committees: string[]; former: boolean }

interface Directory {
  committees: { name: string; chair: { name: string; url: string | null } | null; members: { name: string; url: string | null }[]; staff: { name: string; title: string | null; email: string | null; phone: string | null; url: string | null }[] }[]
  people: { name: string; title: string | null; office: string | null; email: string | null; phone: string | null }[]
  councilmembers?: { name: string; role: string | null; current: boolean }[]
}

/** Find the person a CRM key names in the Council directory. */
export function identify(d: Directory, key: string): Identity | null {
  if (key.startsWith('cm:')) {
    const m = (d.councilmembers ?? []).find(x => councilmemberKey(x.name) === key)
    const committees: string[] = []
    let url: string | null = null
    for (const c of d.committees) {
      if (c.chair && councilmemberKey(c.chair.name) === key) { committees.push(`${c.name} (chair)`); url ??= c.chair.url }
      const seat = c.members.find(x => councilmemberKey(x.name) === key)
      if (seat) { committees.push(c.name); url ??= seat.url }
    }
    if (!m && committees.length === 0) return null
    return { name: m?.name ?? key.slice(3), title: m?.role ?? 'Councilmember', office: null, email: null, phone: null, url, committees, former: m ? !m.current : false }
  }
  for (const c of d.committees) {
    const s = c.staff.find(x => staffKey({ email: x.email, name: x.name, office: c.name }) === key || (x.email && staffKey({ email: x.email, name: x.name, office: null }) === key))
    if (s) {
      const listed = d.people.find(p => staffKey(p) === key)
      return { name: s.name, title: s.title, office: listed?.office ?? c.name, email: s.email, phone: s.phone, url: s.url, committees: [c.name], former: false }
    }
  }
  const p = d.people.find(x => staffKey(x) === key)
  return p ? { name: p.name, title: p.title, office: p.office, email: p.email, phone: p.phone, url: null, committees: [], former: false } : null
}

const today = todayIso
const input: React.CSSProperties = { fontSize: fontSize.sm, padding: '5px 8px', border: `1px solid ${color.borderDefault}`, borderRadius: radius.md, background: color.white }
const primary: React.CSSProperties = { ...input, background: color.linkBlue, color: color.white, border: 'none', cursor: 'pointer', fontWeight: fontWeight.medium }
const quiet: React.CSSProperties = { background: 'none', border: 'none', padding: 0, color: color.textMuted, cursor: 'pointer', fontSize: fontSize.xs }

/**
 * /people/record/:key: the team's record of one Councilmember's office or one
 * Council staffer. Who holds the relationship, our read of where they stand,
 * follow-ups, and a dated contact log. Any member adds; the author or an admin
 * edits. These notes stay in FloorVote and are not sent to the AI.
 */
export function PersonRecord() {
  const { key: rawKey = '' } = useParams()
  const key = decodeURIComponent(rawKey)
  const { user } = useAuth()
  const { demoLocked } = useDemo()
  const isAdmin = user?.role === 'admin' || user?.role === 'owner'

  const [who, setWho] = useState<Identity | null | undefined>(undefined)
  const [rec, setRec] = useState<Record_ | null>(null)
  const [members, setMembers] = useState<Member[]>([])
  const [billOptions, setBillOptions] = useState<BillOption[]>([])
  const [error, setError] = useState<string | null>(null)

  const name = rec?.person?.name ?? who?.name ?? ''
  usePageTitle(name || 'Person')
  const snapshot = useMemo(() => ({ name, office: rec?.person?.office ?? who?.office ?? (who?.title === 'Councilmember' ? null : who?.title ?? null) }), [name, rec, who])

  const reload = useCallback(() => {
    apiFetch<Record_>(`/crm/people/${encodeURIComponent(key)}`).then(r => setRec(r && typeof r === 'object' ? r : null)).catch(() => setError('Could not load this record.'))
  }, [key])

  useEffect(() => {
    apiFetch<Directory>('/directory').then(d => setWho(d ? identify(d, key) : null)).catch(() => setWho(null))
    apiFetch<Member[]>('/users').then(u => setMembers(Array.isArray(u) ? u : [])).catch(() => setMembers([]))
    apiFetch<BillOption[]>('/calendar/bill-options').then(b => setBillOptions(Array.isArray(b) ? b : [])).catch(() => setBillOptions([]))
    reload()
  }, [key, reload])

  async function send(path: string, method: string, body?: unknown): Promise<boolean> {
    setError(null)
    try {
      await apiFetch(path, { method, ...(body !== undefined ? { body: JSON.stringify(body) } : {}) })
      reload()
      return true
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'That did not save. Try again.')
      return false
    }
  }
  const base = `/crm/people/${encodeURIComponent(key)}`
  const canWrite = !demoLocked && !!name
  const mine = (a: Ref | null) => isAdmin || (!!a && a.id === user?.id)

  if (who === undefined && !rec) return <div style={{ padding: 32, color: color.textMuted, fontSize: fontSize.sm }}>Loading…</div>
  if (!who && !rec?.person) {
    return (
      <div style={{ padding: '24px 32px', maxWidth: 820, margin: '0 auto' }}>
        <Link to="/people" className="blue-link" style={{ fontSize: fontSize.sm }}>← People</Link>
        <p style={{ color: color.textMuted, fontSize: fontSize.sm }}>This person is not in the Council directory, and the team has no record of them.</p>
      </div>
    )
  }

  const open = (rec?.followups ?? []).filter(f => !f.doneAt)
  const done = (rec?.followups ?? []).filter(f => f.doneAt)
  const email = plainEmail(who?.email ?? null)
  const profile = councilUrl(who?.url ?? null)

  return (
    <div style={{ padding: '24px 32px', maxWidth: 820, margin: '0 auto', color: color.textSlate, fontSize: fontSize.sm }}>
      <Link to="/people" className="blue-link">← People</Link>
      <h1 style={{ fontSize: fontSize.xl, fontWeight: fontWeight.semibold, margin: '12px 0 4px' }}>{name}</h1>
      <div style={{ color: color.textSecondary, lineHeight: 1.6 }}>
        {[who?.title, who?.office].filter(Boolean).join(', ')}
        {who?.former && <span style={{ color: color.textMuted }}> · Not currently serving</span>}
        {!who && <span style={{ color: color.textMuted }}> · No longer in the Council directory</span>}
        {(email || who?.phone || profile) && <br />}
        {email && <a href={`mailto:${email}`} className="blue-link">{email}</a>}
        {email && who?.phone && ' · '}
        {who?.phone && <a href={`tel:${who.phone.replace(/[^\d+]/g, '')}`} className="blue-link">{who.phone}</a>}
        {profile && <>{(email || who?.phone) && ' · '}<a href={profile} target="_blank" rel="noopener noreferrer" className="blue-link">dccouncil.gov profile</a></>}
        {(who?.committees.length ?? 0) > 0 && <><br /><span style={{ color: color.textMuted }}>Committees: </span>{who!.committees.join('; ')}</>}
      </div>
      {error && <div role="alert" style={{ color: color.textErrorRed, marginTop: 10 }}>{error}</div>}

      <Profile rec={rec} members={members} canWrite={canWrite} onSave={body => send(base, 'PUT', { ...snapshot, ...body })} />

      <section aria-label="Follow-ups" style={{ ...CARD, padding: 14, marginTop: 16 }}>
        <span style={SECTION_LABEL}>Follow-ups</span>
        {open.length === 0 && <div style={{ color: color.textMuted, marginTop: 6 }}>Nothing open.</div>}
        <ul style={{ listStyle: 'none', margin: '8px 0 0', padding: 0, lineHeight: 1.7 }}>
          {open.map(f => (
            <li key={f.id}>
              <label style={{ cursor: canWrite ? 'pointer' : 'default' }}>
                <input type="checkbox" disabled={!canWrite || !(mine(f.author) || f.owner?.id === user?.id)} onChange={() => send(`/crm/followups/${f.id}`, 'PATCH', { done: true })} />{' '}
                {f.text}
              </label>
              <span style={{ color: f.dueDate && f.dueDate < today() ? color.textErrorRed : color.textMuted }}>
                {f.dueDate ? ` · due ${f.dueDate}` : ''}{f.owner ? ` · ${f.owner.name}` : ''}
              </span>
              {canWrite && mine(f.author) && <button type="button" style={{ ...quiet, marginLeft: 8 }} onClick={() => window.confirm('Delete this follow-up?') && send(`/crm/followups/${f.id}`, 'DELETE')}>Delete</button>}
            </li>
          ))}
        </ul>
        {canWrite && <AddFollowup members={members} me={user?.id ?? null} onAdd={body => send(`${base}/followups`, 'POST', { ...snapshot, ...body })} />}
        {done.length > 0 && (
          <details style={{ marginTop: 8 }}>
            <summary style={{ cursor: 'pointer', color: color.textMuted }}>Done ({done.length})</summary>
            <ul style={{ margin: '4px 0 0', paddingLeft: 18, color: color.textSecondary }}>
              {done.map(f => (
                <li key={f.id}>
                  {f.text} <span style={{ color: color.textMuted }}>· done {f.doneAt?.slice(0, 10)}{f.doneBy ? ` by ${f.doneBy.name}` : ''}</span>
                  {canWrite && (mine(f.author) || f.owner?.id === user?.id) && <button type="button" style={{ ...quiet, marginLeft: 8 }} onClick={() => send(`/crm/followups/${f.id}`, 'PATCH', { done: false })}>Reopen</button>}
                </li>
              ))}
            </ul>
          </details>
        )}
      </section>

      <section aria-label="Contact log" style={{ ...CARD, padding: 14, marginTop: 16 }}>
        <span style={SECTION_LABEL}>Contact log</span>
        {canWrite && <AddContact bills={billOptions} onAdd={body => send(`${base}/contacts`, 'POST', { ...snapshot, ...body })} />}
        {(rec?.contacts ?? []).length === 0 && <div style={{ color: color.textMuted, marginTop: 6 }}>No contacts logged yet.</div>}
        {(rec?.contacts ?? []).map(c => (
          <ContactRow key={c.id} c={c} canEdit={canWrite && mine(c.author)} bills={billOptions}
            onSave={body => send(`/crm/contacts/${c.id}`, 'PATCH', body)}
            onDelete={() => window.confirm('Delete this contact entry?') && send(`/crm/contacts/${c.id}`, 'DELETE')} />
        ))}
      </section>
      <div style={{ color: color.textMuted, fontSize: fontSize.xs, marginTop: 12 }}>
        These notes are visible to everyone on the team and stay in FloorVote. They are not sent to the AI that writes analyses and briefs. Never record client information here.
      </div>
    </div>
  )
}

function MemberSelect({ value, members, onChange, label, allowNone = true }: { value: string; members: Member[]; onChange: (v: string) => void; label: string; allowNone?: boolean }) {
  return (
    <select aria-label={label} value={value} onChange={e => onChange(e.target.value)} style={input}>
      {allowNone && <option value="">No one</option>}
      {members.map(m => <option key={m.id} value={m.id}>{m.name || 'Unnamed member'}</option>)}
    </select>
  )
}

function Profile({ rec, members, canWrite, onSave }: { rec: Record_ | null; members: Member[]; canWrite: boolean; onSave: (b: Record<string, unknown>) => Promise<boolean> }) {
  const [stance, setStance] = useState(rec?.person?.stance ?? '')
  const [editing, setEditing] = useState(false)
  useEffect(() => { if (!editing) setStance(rec?.person?.stance ?? '') }, [rec, editing])
  const p = rec?.person
  return (
    <section aria-label="Relationship" style={{ ...CARD, padding: 14, marginTop: 16 }}>
      <span style={SECTION_LABEL}>Relationship</span>
      <div style={{ marginTop: 8, display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        <span style={{ color: color.textMuted }}>Relationship owner:</span>
        {canWrite
          ? <MemberSelect label="Relationship owner" value={p?.owner?.id ?? ''} members={members} onChange={v => onSave({ ownerId: v || null })} />
          : <span>{p?.owner?.name ?? 'No one yet'}</span>}
      </div>
      <div style={{ marginTop: 10 }}>
        <div style={{ color: color.textMuted }}>Where they stand</div>
        {editing ? (
          <>
            <textarea aria-label="Where they stand" value={stance} onChange={e => setStance(e.target.value)} rows={4} maxLength={4000}
              placeholder="Our read: positions they've taken, what moves them, who on staff to work with."
              style={{ ...input, width: '100%', boxSizing: 'border-box', marginTop: 4, fontFamily: 'inherit' }} />
            <div style={{ display: 'flex', gap: 6, marginTop: 6 }}>
              <button type="button" style={primary} onClick={async () => { if (await onSave({ stance })) setEditing(false) }}>Save</button>
              <button type="button" style={{ ...input, cursor: 'pointer' }} onClick={() => setEditing(false)}>Cancel</button>
            </div>
          </>
        ) : (
          <div style={{ whiteSpace: 'pre-wrap', marginTop: 4 }}>
            {p?.stance || <span style={{ color: color.textMuted }}>No notes yet.</span>}
            {canWrite && <button type="button" style={{ ...quiet, marginLeft: 8, color: color.linkBlue }} onClick={() => setEditing(true)}>{p?.stance ? 'Edit' : 'Add notes'}</button>}
          </div>
        )}
        {p?.updatedBy && <div style={{ color: color.textMuted, fontSize: fontSize.xs, marginTop: 4 }}>Last updated by {p.updatedBy.name}, {p.updatedAt.slice(0, 10)}</div>}
      </div>
    </section>
  )
}

function AddFollowup({ members, me, onAdd }: { members: Member[]; me: string | null; onAdd: (b: Record<string, unknown>) => Promise<boolean> }) {
  const [text, setText] = useState('')
  const [due, setDue] = useState('')
  const [owner, setOwner] = useState(me ?? '')
  useEffect(() => { if (!owner && me) setOwner(me) }, [me, owner])
  return (
    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 8 }}>
      <input aria-label="New follow-up" placeholder="Next step, e.g. Send the redline to the committee director" value={text} onChange={e => setText(e.target.value)} maxLength={500} style={{ ...input, flex: '3 1 260px' }} />
      <input aria-label="Due date" type="date" value={due} onChange={e => setDue(e.target.value)} style={input} />
      <MemberSelect label="Follow-up owner" value={owner} members={members} onChange={setOwner} />
      <button type="button" style={primary} disabled={!text.trim()}
        onClick={async () => { if (await onAdd({ text, dueDate: due || null, ownerId: owner || null })) { setText(''); setDue('') } }}>Add</button>
    </div>
  )
}

function ContactFields({ value, set, bills }: { value: { date: string; kind: ContactKind; summary: string; billId: string }; set: (v: { date: string; kind: ContactKind; summary: string; billId: string }) => void; bills: BillOption[] }) {
  return (
    <>
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        <input aria-label="Contact date" type="date" value={value.date} onChange={e => set({ ...value, date: e.target.value })} style={input} />
        <select aria-label="Contact kind" value={value.kind} onChange={e => set({ ...value, kind: e.target.value as ContactKind })} style={input}>
          {CONTACT_KINDS.map(k => <option key={k} value={k}>{CONTACT_KIND_LABEL[k]}</option>)}
        </select>
        <select aria-label="Related bill" value={value.billId} onChange={e => set({ ...value, billId: e.target.value })} style={{ ...input, maxWidth: 260 }}>
          <option value="">No related bill</option>
          {bills.map(b => <option key={b.id} value={b.id}>{b.billNumber}{b.title ? `: ${b.title.slice(0, 60)}` : ''}</option>)}
        </select>
      </div>
      <textarea aria-label="What happened" value={value.summary} onChange={e => set({ ...value, summary: e.target.value })} rows={3} maxLength={4000}
        placeholder="Who you spoke with, what came up, anything they asked for."
        style={{ ...input, width: '100%', boxSizing: 'border-box', marginTop: 6, fontFamily: 'inherit' }} />
    </>
  )
}

function AddContact({ bills, onAdd }: { bills: BillOption[]; onAdd: (b: Record<string, unknown>) => Promise<boolean> }) {
  const blank = () => ({ date: today(), kind: 'meeting' as ContactKind, summary: '', billId: '' })
  const [open, setOpen] = useState(false)
  const [v, setV] = useState(blank)
  if (!open) return <div style={{ marginTop: 6 }}><button type="button" style={{ ...quiet, color: color.linkBlue, fontSize: fontSize.sm }} onClick={() => setOpen(true)}>Log a contact</button></div>
  return (
    <div style={{ marginTop: 8, paddingBottom: 10, borderBottom: `1px solid ${color.borderDefault}` }}>
      <ContactFields value={v} set={setV} bills={bills} />
      <div style={{ display: 'flex', gap: 6, marginTop: 6 }}>
        <button type="button" style={primary} disabled={!v.summary.trim()}
          onClick={async () => { if (await onAdd({ ...v, billId: v.billId || null })) { setV(blank()); setOpen(false) } }}>Save</button>
        <button type="button" style={{ ...input, cursor: 'pointer' }} onClick={() => setOpen(false)}>Cancel</button>
      </div>
    </div>
  )
}

function ContactRow({ c, canEdit, bills, onSave, onDelete }: { c: Contact; canEdit: boolean; bills: BillOption[]; onSave: (b: Record<string, unknown>) => Promise<boolean>; onDelete: () => void }) {
  const [editing, setEditing] = useState(false)
  const [v, setV] = useState({ date: c.date, kind: c.kind, summary: c.summary, billId: c.bill?.id ?? '' })
  if (editing) {
    return (
      <div style={{ marginTop: 10 }}>
        <ContactFields value={v} set={setV} bills={bills} />
        <div style={{ display: 'flex', gap: 6, marginTop: 6 }}>
          <button type="button" style={primary} onClick={async () => { if (await onSave({ ...v, billId: v.billId || null })) setEditing(false) }}>Save</button>
          <button type="button" style={{ ...input, cursor: 'pointer' }} onClick={() => setEditing(false)}>Cancel</button>
        </div>
      </div>
    )
  }
  return (
    <div style={{ marginTop: 10, paddingTop: 10, borderTop: `1px solid ${color.borderDefault}` }}>
      <div style={{ color: color.textMuted, fontSize: fontSize.xs }}>
        {c.date} · {CONTACT_KIND_LABEL[c.kind] ?? c.kind}{c.author ? ` · ${c.author.name}` : ''}
        {c.bill && <> · <Link to={`/bills/${c.bill.id}`} className="blue-link">{c.bill.number}</Link></>}
        {c.updatedAt && ' · edited'}
        {canEdit && <>
          <button type="button" style={{ ...quiet, marginLeft: 8 }} onClick={() => setEditing(true)}>Edit</button>
          <button type="button" style={{ ...quiet, marginLeft: 8 }} onClick={onDelete}>Delete</button>
        </>}
      </div>
      <div style={{ whiteSpace: 'pre-wrap', marginTop: 2 }}>{c.summary}</div>
    </div>
  )
}
