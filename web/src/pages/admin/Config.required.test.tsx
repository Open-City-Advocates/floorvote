import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, within, waitFor, act } from '@testing-library/react'
import React from 'react'
import userEvent from '@testing-library/user-event'

// The required-field pattern on the "Add custom field" form: Name is always
// required, and a dropdown field also needs at least one option. "Add field"
// stays disabled with the visible "Missing a required field (*)" reason until
// both are present, instead of letting the server reject an option-less
// dropdown and surfacing that rejection as a browser alert.

vi.mock('react-router-dom', () => ({
  useNavigate: () => vi.fn(),
  Link: ({ children, to }: { children: React.ReactNode; to: string }) =>
    React.createElement('a', { href: to }, children),
}))
vi.mock('../../lib/api', () => ({
  apiFetch: vi.fn(),
  ApiError: class ApiError extends Error {
    constructor(public status: number, message: string) { super(message) }
  },
}))
vi.mock('../../hooks/usePageTitle', () => ({ usePageTitle: () => {} }))
vi.mock('../../hooks/useAuth', () => ({
  useAuth: () => ({ user: { id: 'u1', email: 'a@b.com', name: 'Admin', role: 'admin' }, loading: false }),
}))
const { demo } = vi.hoisted(() => ({ demo: { demoMode: false, demoLocked: false } }))
vi.mock('../../context/DemoContext', () => ({ useDemo: () => demo }))
vi.mock('../../components/SettingsNav', () => ({
  SettingsNav: () => React.createElement('div', { 'data-testid': 'settings-nav' }),
}))
vi.mock('../../components/ResizableTextarea', () => ({
  ResizableTextarea: ({ value, onChange, ...rest }: React.ComponentProps<'textarea'>) =>
    React.createElement('textarea', { value, onChange, ...rest }),
}))
vi.mock('../../components/HintText', () => ({
  HintText: ({ text }: { text: string }) => React.createElement('span', null, text),
}))
vi.mock('../../components/RichTextEditor', () => ({
  RichTextEditor: () => React.createElement('div', { 'data-testid': 'rich-text-editor' }),
}))
vi.mock('../../components/BillBadge', () => ({ BillBadge: () => null }))
vi.mock('../../lib/exportData', () => ({ exportAllData: vi.fn() }))

import { apiFetch } from '../../lib/api'
import { Config } from './Config'

const mockFetch = vi.mocked(apiFetch)
const REASON = 'Missing a required field (*)'

const BASE_CONFIG = {
  keywords: [],
  association_name: 'Test Org',
  org_noun: 'association',
  ai_context: '',
  relevance_question: '',
  tag_taxonomy: [],
  matched_bills_count: 0,
  prioritized_bills_count: 0,
}

let holdCreate: { release: () => void } | null = null

function mockApi({ hold = false }: { hold?: boolean } = {}) {
  mockFetch.mockImplementation(async (path: string, init?: RequestInit) => {
    if (path === '/admin/config') return { ...BASE_CONFIG }
    if (path === '/admin/custom-fields' && init?.method === 'POST') {
      if (hold) await new Promise<void>(resolve => { holdCreate = { release: resolve } })
      const body = JSON.parse(String(init.body))
      return { id: 'new', pinned: false, multiple: false, options: body.options ?? null, ...body }
    }
    if (path === '/admin/custom-fields') return []
    if (path === '/bills/drafts') return { drafts: [] }
    throw new Error('unexpected path: ' + path)
  })
}

function posts() {
  return mockFetch.mock.calls.filter(([p, init]) => p === '/admin/custom-fields' && (init as RequestInit | undefined)?.method === 'POST')
}

async function form() {
  return screen.findByRole('group', { name: 'Add custom field' })
}

function addButton(f: HTMLElement) {
  return within(f).getByRole('button', { name: /^(add field|adding…)$/i })
}

function reason(f: HTMLElement) {
  return within(f).queryByText('Missing a required field')
}

async function setup() {
  const user = userEvent.setup()
  render(<Config />)
  const f = await form()
  return { user, f }
}

async function chooseDropdown(user: ReturnType<typeof userEvent.setup>, f: HTMLElement) {
  await user.selectOptions(within(f).getByLabelText('Type'), 'dropdown')
}

let alertSpy: ReturnType<typeof vi.spyOn>

beforeEach(() => {
  vi.resetAllMocks()
  demo.demoLocked = false
  holdCreate = null
  mockApi()
  alertSpy = vi.spyOn(window, 'alert').mockImplementation(() => {})
})
afterEach(() => { alertSpy.mockRestore() })

describe('Config "Add custom field" required fields', () => {
  it('shows a "* Required" legend on the form', async () => {
    const { f } = await setup()
    expect(within(f).getByText('Required').parentElement).toHaveTextContent('* Required')
  })

  it('labels the Name input and marks it required', async () => {
    const { f } = await setup()
    const name = within(f).getByLabelText(/^name/i)
    expect(name.tagName).toBe('INPUT')
    expect(name).toHaveAttribute('aria-required', 'true')
    expect(within(f).getAllByText(/^Name/).find(el => el.tagName === 'LABEL')).toHaveTextContent('Name *')
  })

  it('labels the Type select and does not mark it required', async () => {
    const { f } = await setup()
    const type = within(f).getByLabelText('Type')
    expect(type.tagName).toBe('SELECT')
    expect(type).not.toHaveAttribute('aria-required')
  })

  it('shows the reason beside the disabled button while Name is empty', async () => {
    const { f } = await setup()
    expect(addButton(f)).toBeDisabled()
    expect(reason(f)?.closest('[id]')).toHaveTextContent(REASON)
  })

  it('links the disabled button to the reason with aria-describedby', async () => {
    const { f } = await setup()
    expect(addButton(f)).toHaveAccessibleDescription('Missing a required field')
    const id = addButton(f).getAttribute('aria-describedby')
    expect(document.getElementById(id!)).toHaveTextContent(REASON)
  })

  it('hides the reason once Name is typed, and brings it back when cleared', async () => {
    const { user, f } = await setup()
    const name = within(f).getByLabelText(/^name/i)
    await user.type(name, 'Committee')
    expect(addButton(f)).toBeEnabled()
    expect(reason(f)).not.toBeInTheDocument()
    expect(addButton(f)).not.toHaveAttribute('aria-describedby')

    await user.clear(name)
    expect(addButton(f)).toBeDisabled()
    expect(reason(f)).toBeInTheDocument()
  })

  it('treats a whitespace-only Name as missing', async () => {
    const { user, f } = await setup()
    await user.type(within(f).getByLabelText(/^name/i), '   ')
    expect(addButton(f)).toBeDisabled()
    expect(reason(f)).toBeInTheDocument()
  })

  it('does not show the reason when the button is disabled only by demo lock', async () => {
    demo.demoLocked = true
    const { user, f } = await setup()
    await user.type(within(f).getByLabelText(/^name/i), 'Committee')
    expect(addButton(f)).toBeDisabled()
    expect(reason(f)).not.toBeInTheDocument()
    expect(addButton(f)).not.toHaveAttribute('aria-describedby')
  })

  it('does not show the reason under demo lock even while Name is empty', async () => {
    demo.demoLocked = true
    const { f } = await setup()
    expect(addButton(f)).toBeDisabled()
    expect(reason(f)).not.toBeInTheDocument()
  })

  it('does not show the reason while the create request is in flight', async () => {
    mockApi({ hold: true })
    const { user, f } = await setup()
    await user.type(within(f).getByLabelText(/^name/i), 'Committee')
    await user.click(addButton(f))
    await waitFor(() => expect(posts()).toHaveLength(1))
    const busy = within(f).getByRole('button', { name: /adding/i })
    expect(busy).toBeDisabled()
    expect(reason(f)).not.toBeInTheDocument()
    expect(busy).not.toHaveAttribute('aria-describedby')
    await act(async () => { holdCreate?.release() })
  })

  it('shows the reason again after a field is added and the form resets', async () => {
    const { user, f } = await setup()
    await user.type(within(f).getByLabelText(/^name/i), 'Committee')
    await user.click(addButton(f))
    await waitFor(() => expect(posts()).toHaveLength(1))
    await waitFor(() => expect(within(f).getByLabelText(/^name/i)).toHaveValue(''))
    expect(reason(f)).toBeInTheDocument()
  })
})

describe('Config "Add custom field": a dropdown needs at least one option', () => {
  it('marks the Options input required once Dropdown is chosen', async () => {
    const { user, f } = await setup()
    await chooseDropdown(user, f)
    const options = within(f).getByLabelText(/^options/i)
    expect(options).toHaveAttribute('aria-required', 'true')
    expect(within(f).getAllByText(/^Options/).find(el => el.tagName === 'LABEL')).toHaveTextContent('*')
  })

  it('blocks "Add field" with the reason for a named dropdown with no options', async () => {
    const { user, f } = await setup()
    await user.type(within(f).getByLabelText(/^name/i), 'Committee')
    await chooseDropdown(user, f)
    expect(addButton(f)).toBeDisabled()
    expect(reason(f)).toBeInTheDocument()
    expect(addButton(f)).toHaveAccessibleDescription('Missing a required field')
  })

  it('never calls window.alert or the server for an option-less dropdown, even on Enter', async () => {
    const { user, f } = await setup()
    await chooseDropdown(user, f)
    const name = within(f).getByLabelText(/^name/i)
    await user.type(name, 'Committee{Enter}')
    await user.click(addButton(f))
    expect(alertSpy).not.toHaveBeenCalled()
    expect(posts()).toHaveLength(0)
  })

  it('treats options that are only commas and spaces as no options', async () => {
    const { user, f } = await setup()
    await user.type(within(f).getByLabelText(/^name/i), 'Committee')
    await chooseDropdown(user, f)
    await user.type(within(f).getByLabelText(/^options/i), ' , ,  ')
    expect(addButton(f)).toBeDisabled()
    expect(reason(f)).toBeInTheDocument()
    await user.type(within(f).getByLabelText(/^options/i), '{Enter}')
    expect(alertSpy).not.toHaveBeenCalled()
    expect(posts()).toHaveLength(0)
  })

  it('enables "Add field" once an option is typed, and blocks it again when cleared', async () => {
    const { user, f } = await setup()
    await user.type(within(f).getByLabelText(/^name/i), 'Committee')
    await chooseDropdown(user, f)
    const options = within(f).getByLabelText(/^options/i)
    await user.type(options, 'Finance')
    expect(addButton(f)).toBeEnabled()
    expect(reason(f)).not.toBeInTheDocument()

    await user.clear(options)
    expect(addButton(f)).toBeDisabled()
    expect(reason(f)).toBeInTheDocument()
  })

  it('sends the dropdown once it has a name and an option', async () => {
    const { user, f } = await setup()
    await user.type(within(f).getByLabelText(/^name/i), 'Committee')
    await chooseDropdown(user, f)
    await user.type(within(f).getByLabelText(/^options/i), 'Finance, Judiciary')
    await user.click(addButton(f))
    await waitFor(() => expect(posts()).toHaveLength(1))
    expect(JSON.parse(String((posts()[0][1] as RequestInit).body))).toMatchObject({
      name: 'Committee', type: 'dropdown', options: ['Finance', 'Judiciary'],
    })
    expect(alertSpy).not.toHaveBeenCalled()
  })

  it('stops requiring options when the type is switched away from Dropdown', async () => {
    const { user, f } = await setup()
    await user.type(within(f).getByLabelText(/^name/i), 'Committee')
    await chooseDropdown(user, f)
    expect(addButton(f)).toBeDisabled()
    await user.selectOptions(within(f).getByLabelText('Type'), 'text')
    expect(within(f).queryByLabelText(/^options/i)).not.toBeInTheDocument()
    expect(addButton(f)).toBeEnabled()
    expect(reason(f)).not.toBeInTheDocument()
  })

  it('does not show the reason for an option-less dropdown under demo lock', async () => {
    demo.demoLocked = true
    const { user, f } = await setup()
    await chooseDropdown(user, f)
    expect(addButton(f)).toBeDisabled()
    expect(reason(f)).not.toBeInTheDocument()
  })
})
