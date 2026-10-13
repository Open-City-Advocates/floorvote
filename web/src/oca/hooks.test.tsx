import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter, matchRoutes } from 'react-router-dom'

// The fork's hooks in App.tsx (ocaRoutes) and Sidebar.tsx (OcaSidebarLinks).
// An upstream merge that drops either would hide the People pages without an
// error: the routes would fall through to the not-found page.
vi.mock('../lib/api', () => ({
  apiFetch: vi.fn(async (path: string) => {
    if (path === '/auth/me') {
      return {
        id: 'u1', email: 'a@b.c', name: 'A', role: 'member', subtitle: null,
        canVote: false, emailDigestEnabled: false, emailWeekAheadEnabled: false,
        lastSeenFeed: null, isLastOwner: false,
      }
    }
    if (path === '/config') return { states: ['DC'], modules: {} }
    if (path === '/notifications') return { unreadCount: 0 }
    if (path === '/stats') return { billCount: 10, memberCount: 3, calendarUpcomingCount: 0, calendarUpcomingDays: 30 }
    if (path === '/stats/sidebar') return { priorityBillCount: 0, unvotedPriorityCount: 0, upcomingHearings: [], upcomingHearingsDays: 30, priorityBills: [] }
    if (path.startsWith('/feed')) return { latestEventAt: null, lastSeenFeed: null }
    return {}
  }),
  ApiError: class ApiError extends Error {
    status: number
    constructor(status: number, message: string) { super(message); this.status = status }
  },
}))

import { routes } from '../App'
import { Sidebar } from '../components/Sidebar'
import { AuthProvider } from '../context/AuthContext'
import { ConfigProvider } from '../context/ConfigContext'
import { SidebarRefreshProvider } from '../context/SidebarRefreshContext'
import { NotificationsProvider } from '../context/NotificationsContext'
import { FeedUnreadProvider } from '../context/FeedUnreadContext'

function renderSidebar() {
  return render(
    <MemoryRouter initialEntries={['/bills']}>
      <AuthProvider><ConfigProvider><SidebarRefreshProvider><NotificationsProvider><FeedUnreadProvider>
        <Sidebar isOpen={false} onClose={() => {}} />
      </FeedUnreadProvider></NotificationsProvider></SidebarRefreshProvider></ConfigProvider></AuthProvider>
    </MemoryRouter>,
  )
}

describe('the fork\'s hooks into the web app', () => {
  it('routes the People, person record, and hearing brief pages', () => {
    for (const [url, path] of [['/people', 'people'], ['/people/record/cm:x', 'people/record/:key'], ['/calendar/brief/e1', 'calendar/brief/:eventId']]) {
      const matches = matchRoutes(routes, url) ?? []
      expect(matches[matches.length - 1]?.route.path, url).toBe(path)
    }
  })

  it('links People in the sidebar for a DC instance', async () => {
    renderSidebar()
    expect(await screen.findByRole('link', { name: 'People' })).toHaveAttribute('href', '/people')
  })
})
