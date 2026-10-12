/**
 * NotificationsSlideOver — rendering by kind
 *
 * GET /notifications returns rows discriminated on `kind`, and the panel picks a
 * renderer per kind. A kind this build has no renderer for (a newer server) is
 * skipped, never drawn as a mention.
 */
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { NotificationsSlideOver } from './NotificationsSlideOver'
import { NotificationsProvider } from '../context/NotificationsContext'

vi.mock('../context/DemoContext', () => ({
  useDemo: () => ({ demoMode: false, demoLocked: false, settled: true, demoResetAt: 'epoch-1' }),
}))

const row = (over: Record<string, unknown>) => ({
  commentId: 'c1', billId: 'b1',
  billNumber: 'SB123', billTitle: 'A test bill', billState: 'NJ', billIsDraft: false,
  sessionSlug: 'session-1',
  authorId: 'u1', authorName: 'Alice Author', authorSubtitle: null,
  commentPreview: 'preview', commentHtml: '<p>Please review.</p>',
  sourceType: 'user', sourceLabel: null,
  createdAt: new Date().toISOString(), isUnread: true,
  ...over,
})

vi.mock('../lib/api', () => ({
  apiFetch: vi.fn(async (path: string) => {
    if (path === '/notifications') {
      return {
        unreadCount: 2,
        notifications: [
          row({ kind: 'mention', id: 'n1', authorName: 'Alice Author' }),
          row({ kind: 'some_future_kind', id: 'n2', authorName: 'Zed Future' }),
        ],
      }
    }
    if (path === '/roles') return []
    return {}
  }),
}))

describe('NotificationsSlideOver kinds', () => {
  it('renders a mention row and skips a kind it has no renderer for', async () => {
    render(
      <MemoryRouter>
        <NotificationsProvider>
          <NotificationsSlideOver onClose={() => {}} />
        </NotificationsProvider>
      </MemoryRouter>,
    )

    expect(await screen.findByText('Alice Author')).toBeInTheDocument()
    expect(screen.getByText('mentioned you')).toBeInTheDocument()
    expect(screen.queryByText('Zed Future')).not.toBeInTheDocument()
    expect(screen.getAllByRole('link')).toHaveLength(1)
  })
})
