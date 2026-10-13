import { memo, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { apiFetch } from '../../lib/api'
import { decodeStatus } from '../../lib/legislativeStatus'
import { billUrl } from '../../lib/sessionSlug'
import { normalizeViewQuery, matchesUrlIdentifier } from '../../lib/savedViews'
import { BillBadge } from '../../components/BillBadge'
import { DraftChip } from '../../components/DraftChip'
import { StatusChip } from '../../components/StatusChip'
import { SECTION_LABEL, CHROME_TEXT, SR_ONLY } from '../../lib/textStyles'
import { color, fontSize } from '../../styles/tokens'
import { billDisplayTitle } from '../../../../shared/billTitle'
import { billsApiParams, billsFilterValuesFromSearch } from './billsQuery'
import { peekBillsListCache } from './index'
import { PAGE_SIZE } from './constants'
import type { Bill } from './types'
import type { SavedView } from './ViewSwitcher'

// Viewport width at which a bill page shows this pane beside it. At 1440 with
// the default 230px sidebar and this 300px pane, BillDetail still gets about
// 900px — what it gets today in a ~1150px window, wide enough that its
// 272px right column and its main column sit side by side as they do now.
export const BILL_SPLIT_MIN_WIDTH = 1440
const PANE_WIDTH = 300

type BillsPage = { bills: Bill[]; pagination: { page: number; pageSize: number; total: number; totalPages: number } }

// The Bills page records its own URL in sessionStorage on every change (the
// sidebar's Bills link and BillDetail's "Back to bills" both read it), so the
// pane shows that same list. A saved view leaves the URL in its short
// `?view=<slug>` form, which spells out no filters, so it is expanded from
// /views here the way BillList hydrates it.
async function resolveListSearch(listUrl: string): Promise<URLSearchParams> {
  const search = new URLSearchParams(listUrl.includes('?') ? listUrl.slice(listUrl.indexOf('?') + 1) : '')
  const viewId = search.get('view')
  if (!viewId || normalizeViewQuery(search.toString()) !== '') return search
  try {
    const { views } = await apiFetch<{ views: SavedView[] }>('/views')
    const view = (views ?? []).find(v => matchesUrlIdentifier(v, viewId))
    if (view) return new URLSearchParams(view.query)
  } catch {
    // Fall through to the unfiltered list rather than showing nothing.
  }
  return search
}

// location.pathname arrives percent-encoded ("HB%205042") while billUrl builds
// the raw form ("HB 5042"), so compare decoded.
function decodePath(path: string): string {
  try { return decodeURI(path) } catch { return path }
}

const PaneRow = memo(function PaneRow({ bill, path, isCurrent, billPaths, index }: {
  bill: Bill; path: string; isCurrent: boolean; billPaths: string[]; index: number
}) {
  const [hovered, setHovered] = useState(false)
  return (
    <Link
      to={path}
      // Same prev/next context a click on the Bills page passes, so
      // BillDetail's previous/next controls walk this list.
      state={{ billPaths, currentIndex: index }}
      aria-current={isCurrent ? 'page' : undefined}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: 'block',
        padding: '8px 12px 9px',
        borderBottom: `1px solid ${color.borderDefault}`,
        borderLeft: `3px solid ${isCurrent ? color.accentBlue : 'transparent'}`,
        background: isCurrent ? color.bgBlueChip : hovered ? color.surfaceSubtle : color.white,
        color: 'inherit',
        textDecoration: 'none',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
        <BillBadge mini billNumber={bill.billNumber} state={bill.state} isDraft={bill.isDraft} priority={bill.priority} />
        {bill.priority && <span style={SR_ONLY}>, {bill.priority} priority</span>}
        <span style={{ marginLeft: 'auto', display: 'flex', minWidth: 0 }}>
          {bill.isDraft ? <DraftChip mini /> : <StatusChip status={decodeStatus(bill.status)} />}
        </span>
      </div>
      <div style={{
        fontSize: fontSize.sm,
        color: color.textPrimary,
        lineHeight: 1.35,
        display: '-webkit-box',
        WebkitLineClamp: 2,
        WebkitBoxOrient: 'vertical',
        overflow: 'hidden',
      }}>
        {billDisplayTitle(bill)}
      </div>
    </Link>
  )
})

/**
 * The Bills list, compact, beside a bill on wide screens. AppLayout mounts it
 * once for every bill route, so it keeps its scroll position as the reader
 * moves from bill to bill.
 */
export function BillListPane() {
  const location = useLocation()
  const [listUrl] = useState(() => sessionStorage.getItem('lastBillsUrl') ?? '/bills')
  const [search, setSearch] = useState<URLSearchParams | null>(null)
  const [bills, setBills] = useState<Bill[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [hasMore, setHasMore] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const scrollRef = useRef<HTMLUListElement>(null)

  useEffect(() => {
    let cancelled = false
    void resolveListSearch(listUrl).then(s => { if (!cancelled) setSearch(s) })
    return () => { cancelled = true }
  }, [listUrl])

  useEffect(() => {
    if (!search) return
    let cancelled = false
    const params = billsApiParams(billsFilterValuesFromSearch(search), 1, PAGE_SIZE)
    // The Bills page's first-page cache paints instantly when it holds this
    // same query; the fetch below then refreshes it.
    const cached = peekBillsListCache()
    if (cached?.params === params) {
      setBills(cached.page.bills)
      setTotal(cached.page.total)
      setHasMore(cached.page.totalPages > 1)
      setLoading(false)
    }
    apiFetch<BillsPage>(`/bills?${params}`)
      .then(data => {
        if (cancelled) return
        setBills(data.bills)
        setTotal(data.pagination.total)
        setHasMore(data.pagination.totalPages > 1)
        setPage(1)
        setError(false)
      })
      .catch(() => { if (!cancelled && !cached) setError(true) })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [search])

  const [loadingMore, setLoadingMore] = useState(false)
  function loadMore() {
    if (!search || loadingMore) return
    setLoadingMore(true)
    const next = page + 1
    apiFetch<BillsPage>(`/bills?${billsApiParams(billsFilterValuesFromSearch(search), next, PAGE_SIZE)}`)
      .then(data => {
        setBills(prev => [...prev, ...data.bills])
        setHasMore(next < data.pagination.totalPages)
        setPage(next)
      })
      .catch(() => {})
      .finally(() => setLoadingMore(false))
  }

  const here = decodePath(location.pathname)
  const paths = useMemo(() => bills.map(b => billUrl({ id: b.id, state: b.state, sessionSlug: b.sessionSlug, billNumber: b.billNumber })), [bills])

  // Bring the current bill into view only when it is off-screen, and only when
  // the bill changes (or the list first arrives) — never when "Show more"
  // appends, which would yank the reader back from where they scrolled.
  const hasBills = bills.length > 0
  useLayoutEffect(() => {
    const list = scrollRef.current
    const row = list?.querySelector<HTMLElement>('[aria-current="page"]')
    if (!list || !row) return
    const li = row.parentElement as HTMLElement
    const top = li.offsetTop
    const bottom = top + li.offsetHeight
    if (top < list.scrollTop || bottom > list.scrollTop + list.clientHeight) {
      list.scrollTop = top - (list.clientHeight - li.offsetHeight) / 2
    }
  }, [location.pathname, hasBills])

  return (
    <nav
      aria-label="Bill list"
      className="bill-list-pane"
      style={{
        width: PANE_WIDTH,
        flexShrink: 0,
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        background: color.white,
        borderRight: `1px solid ${color.borderDefault}`,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, padding: '14px 12px 10px 15px', borderBottom: `1px solid ${color.borderDefault}` }}>
        <Link to={listUrl} style={{ ...SECTION_LABEL, color: color.linkBlue, textDecoration: 'none' }}>Bills</Link>
        {!loading && !error && <span style={CHROME_TEXT}>{total.toLocaleString()} {total === 1 ? 'bill' : 'bills'}</span>}
      </div>
      {loading ? (
        <p style={{ ...CHROME_TEXT, padding: '12px 15px', margin: 0 }}>Loading bills…</p>
      ) : error ? (
        <p style={{ ...CHROME_TEXT, padding: '12px 15px', margin: 0 }}>Couldn’t load bills.</p>
      ) : bills.length === 0 ? (
        <p style={{ ...CHROME_TEXT, padding: '12px 15px', margin: 0 }}>No bills match this list’s filters.</p>
      ) : (
        <ul ref={scrollRef} style={{ listStyle: 'none', margin: 0, padding: 0, flex: 1, minHeight: 0, overflowY: 'auto', position: 'relative' }}>
          {bills.map((b, i) => (
            <li key={b.id}>
              <PaneRow bill={b} path={paths[i]} isCurrent={paths[i] === here} billPaths={paths} index={i} />
            </li>
          ))}
          {hasMore && (
            <li style={{ padding: 12 }}>
              <button
                type="button"
                onClick={loadMore}
                disabled={loadingMore}
                style={{ width: '100%', padding: '6px 10px', fontSize: fontSize.sm, color: color.linkBlue, background: color.white, border: `1px solid ${color.borderDefault}`, cursor: 'pointer' }}
              >
                {loadingMore ? 'Loading…' : `Show more (${bills.length.toLocaleString()} of ${total.toLocaleString()})`}
              </button>
            </li>
          )}
        </ul>
      )}
    </nav>
  )
}
