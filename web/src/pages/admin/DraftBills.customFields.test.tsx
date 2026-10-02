import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, within, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { useState } from 'react'
import { DraftBills } from './DraftBills'
import * as api from '../../lib/api'
import type { CustomFieldDef } from '../../components/CustomFieldsSection'

// Custom fields at draft creation: the create form shows every defined custom
// field with the bill page's inputs, collects the values without saving them,
// and sends them with the create request.

vi.mock('../../context/DemoContext', () => ({
  useDemo: () => ({ demoMode: false, demoLocked: false }),
}))

// The real RichTextEditor is a Tiptap instance that does not run in jsdom.
// Stub it with a textarea that reports changes (Summary / Bill text) and, when
// it has a submit label (the text custom field's editor), a submit button.
vi.mock('../../components/RichTextEditor', () => ({
  RichTextEditor: ({ onChange, onSubmit, onCancel, placeholder, submitLabel, initialContent }: {
    onChange?: (html: string) => void
    onSubmit?: (html: string) => void
    onCancel?: () => void
    placeholder?: string
    submitLabel?: string
    initialContent?: string
  }) => {
    const [value, setValue] = useState(initialContent ?? '')
    return (
      <div>
        <textarea
          aria-label={placeholder ?? 'Rich text'}
          value={value}
          onChange={e => { setValue(e.target.value); onChange?.(`<p>${e.target.value}</p>`) }}
        />
        {submitLabel && <button type="button" onClick={() => onSubmit?.(value ? `<p>${value}</p>` : '')}>{submitLabel}</button>}
        {onCancel && <button type="button" onClick={onCancel}>Cancel edit</button>}
      </div>
    )
  },
}))

const FIELDS: CustomFieldDef[] = [
  { id: 'f-multi', name: 'Tags', slug: 'tags', type: 'dropdown', options: ['Tag A', 'Tag B', 'Tag C'], multiple: true, displayOrder: 4, pinned: false },
  { id: 'f-text', name: 'Notes field', slug: 'notes', type: 'text', options: null, multiple: false, displayOrder: 0, pinned: false },
  { id: 'f-date', name: 'Due date', slug: 'due', type: 'date', options: null, multiple: false, displayOrder: 1, pinned: false },
  { id: 'f-binary', name: 'Reviewed', slug: 'reviewed', type: 'binary', options: null, multiple: false, displayOrder: 2, pinned: false },
  { id: 'f-single', name: 'Topic', slug: 'topic', type: 'dropdown', options: ['Category A', 'Category B'], multiple: false, displayOrder: 3, pinned: false },
]

type Opts = { fields?: CustomFieldDef[] | 'fail'; createFails?: boolean }

function mockApi(opts: Opts = {}) {
  const posted: Record<string, unknown>[] = []
  const spy = vi.spyOn(api, 'apiFetch').mockImplementation(async (path: string, init?: RequestInit) => {
    if (path === '/bills/drafts') return { drafts: [] } as never
    if (path === '/bills/facets') return { state: { UT: 5 } } as never
    if (path.startsWith('/bills/draft-defaults')) return { billNumber: 'D1', year: 2026, tenantState: 'UT' } as never
    if (path === '/config/custom-fields') {
      if (opts.fields === 'fail') throw new Error('network')
      return (opts.fields ?? FIELDS) as never
    }
    if (path === '/bills/draft') {
      posted.push(JSON.parse(String(init?.body)))
      if (opts.createFails) throw new api.ApiError(400, 'invalid_options')
      return { id: 'new-draft' } as never
    }
    return {} as never
  })
  return { posted, spy }
}

// Rendered without <Routes>, so the page stays mounted after a successful
// create navigates away — that is what lets the reset be observed.
function renderPage() {
  return render(<MemoryRouter><DraftBills /></MemoryRouter>)
}

async function openForm(user = userEvent.setup()) {
  await user.click(await screen.findByRole('button', { name: /add draft bill/i }))
  await screen.findByDisplayValue('D1')
  return user
}

/** The row holding a custom field, found by its visible label. */
function fieldRow(name: string): HTMLElement {
  const label = screen.getByText(name, { selector: 'span' })
  return label.parentElement as HTMLElement
}

async function pickSingle(user: ReturnType<typeof userEvent.setup>, field: string, option: string) {
  await user.click(within(fieldRow(field)).getByRole('button'))
  fireEvent.click(screen.getByRole('radio', { name: option }))
}

async function pickMulti(user: ReturnType<typeof userEvent.setup>, field: string, options: string[]) {
  await user.click(within(fieldRow(field)).getByRole('button'))
  for (const o of options) fireEvent.click(screen.getByRole('checkbox', { name: o }))
  // Close the panel.
  await user.click(within(fieldRow(field)).getByRole('button'))
}

// Collect mode keeps text fields open and reports every keystroke: typing is
// enough, there is no per-field Save to click.
async function setText(user: ReturnType<typeof userEvent.setup>, field: string, text: string) {
  await user.type(within(fieldRow(field)).getByRole('textbox'), text)
}

async function submit(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole('button', { name: /create draft/i }))
}

describe('DraftBills create form: custom fields render', () => {
  beforeEach(() => vi.restoreAllMocks())

  it('shows an input for every defined field type', async () => {
    mockApi()
    renderPage()
    await openForm()
    expect(await screen.findByText('Custom fields')).toBeInTheDocument()
    // text: an always-open editor, no Edit/Save toggle
    expect(within(fieldRow('Notes field')).getByRole('textbox')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Edit Notes field' })).not.toBeInTheDocument()
    // date
    expect(screen.getByLabelText('Due date')).toHaveAttribute('type', 'date')
    // yes/no
    expect(screen.getByRole('checkbox', { name: 'Reviewed' })).not.toBeChecked()
    // single and multi-select dropdowns, both starting unset
    expect(within(fieldRow('Topic')).getByRole('button')).toHaveTextContent('Not set')
    expect(within(fieldRow('Tags')).getByRole('button')).toHaveTextContent('Not set')
  })

  it('lists the fields in their display order', async () => {
    mockApi()
    renderPage()
    await openForm()
    await screen.findByText('Custom fields')
    const names = ['Notes field', 'Due date', 'Reviewed', 'Topic', 'Tags']
    const els = names.map(n => screen.getByText(n, { selector: 'span' }))
    for (let i = 1; i < els.length; i++) {
      expect(els[i - 1].compareDocumentPosition(els[i]) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    }
  })

  it('places the custom fields below the main fields and above the submit button', async () => {
    mockApi()
    renderPage()
    await openForm()
    const heading = await screen.findByText('Custom fields')
    const billText = screen.getByText('Bill text')
    const submitBtn = screen.getByRole('button', { name: /create draft/i })
    expect(billText.compareDocumentPosition(heading) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    expect(heading.compareDocumentPosition(submitBtn) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  })

  it('shows no custom fields section when the team has defined none', async () => {
    const { posted } = mockApi({ fields: [] })
    renderPage()
    const user = await openForm()
    expect(screen.queryByText('Custom fields')).not.toBeInTheDocument()
    await submit(user)
    await waitFor(() => expect(posted).toHaveLength(1))
    expect(posted[0]).not.toHaveProperty('customFields')
  })

  it('still lets the admin create a draft when the custom fields fail to load', async () => {
    const { posted } = mockApi({ fields: 'fail' })
    renderPage()
    const user = await openForm()
    expect(screen.queryByText('Custom fields')).not.toBeInTheDocument()
    await submit(user)
    await waitFor(() => expect(posted).toHaveLength(1))
    expect(posted[0]).not.toHaveProperty('customFields')
  })

  it('keeps every custom field optional: Create draft is enabled with all of them blank', async () => {
    const { posted } = mockApi()
    renderPage()
    const user = await openForm()
    await screen.findByText('Custom fields')
    expect(screen.getByRole('button', { name: /create draft/i })).toBeEnabled()
    await submit(user)
    await waitFor(() => expect(posted).toHaveLength(1))
    expect(posted[0]).not.toHaveProperty('customFields')
  })

  it('shows no "Set by" audit line for values not yet saved', async () => {
    mockApi()
    renderPage()
    const user = await openForm()
    await screen.findByText('Custom fields')
    await user.click(screen.getByRole('checkbox', { name: 'Reviewed' }))
    await pickSingle(user, 'Topic', 'Category A')
    expect(screen.queryByText(/set by/i)).not.toBeInTheDocument()
  })
})

describe('DraftBills create form: custom field values reach the request', () => {
  beforeEach(() => vi.restoreAllMocks())

  it('sends a text value', async () => {
    const { posted } = mockApi()
    renderPage()
    const user = await openForm()
    await screen.findByText('Custom fields')
    await setText(user, 'Notes field', 'Some notes')
    await submit(user)
    await waitFor(() => expect(posted).toHaveLength(1))
    expect(posted[0].customFields).toEqual({ 'f-text': '<p>Some notes</p>' })
  })

  it('sends text typed into a text field without any per-field save click', async () => {
    const { posted } = mockApi()
    renderPage()
    const user = await openForm()
    await screen.findByText('Custom fields')
    await user.type(within(fieldRow('Notes field')).getByRole('textbox'), 'Typed only')
    expect(within(fieldRow('Notes field')).queryByRole('button', { name: 'Save' })).not.toBeInTheDocument()
    await submit(user)
    await waitFor(() => expect(posted).toHaveLength(1))
    expect(posted[0].customFields).toEqual({ 'f-text': '<p>Typed only</p>' })
  })

  it('sends nothing for a text field typed into and then cleared', async () => {
    const { posted } = mockApi()
    renderPage()
    const user = await openForm()
    await screen.findByText('Custom fields')
    const box = within(fieldRow('Notes field')).getByRole('textbox')
    await user.type(box, 'abc')
    await user.clear(box)
    await submit(user)
    await waitFor(() => expect(posted).toHaveLength(1))
    expect(posted[0].customFields).toBeUndefined()
  })

  it('sends a date value', async () => {
    const { posted } = mockApi()
    renderPage()
    const user = await openForm()
    await screen.findByText('Custom fields')
    fireEvent.change(screen.getByLabelText('Due date'), { target: { value: '2027-01-15' } })
    expect(screen.getByLabelText('Due date')).toHaveValue('2027-01-15')
    await submit(user)
    await waitFor(() => expect(posted).toHaveLength(1))
    expect(posted[0].customFields).toEqual({ 'f-date': '2027-01-15' })
  })

  it('sends a checked yes/no value', async () => {
    const { posted } = mockApi()
    renderPage()
    const user = await openForm()
    await screen.findByText('Custom fields')
    await user.click(screen.getByRole('checkbox', { name: 'Reviewed' }))
    expect(screen.getByRole('checkbox', { name: 'Reviewed' })).toBeChecked()
    await submit(user)
    await waitFor(() => expect(posted).toHaveLength(1))
    expect(posted[0].customFields).toEqual({ 'f-binary': '1' })
  })

  it('does not send a yes/no field that was checked and then unchecked', async () => {
    const { posted } = mockApi()
    renderPage()
    const user = await openForm()
    await screen.findByText('Custom fields')
    await user.click(screen.getByRole('checkbox', { name: 'Reviewed' }))
    await user.click(screen.getByRole('checkbox', { name: 'Reviewed' }))
    await submit(user)
    await waitFor(() => expect(posted).toHaveLength(1))
    expect(posted[0]).not.toHaveProperty('customFields')
  })

  it('sends a single-select dropdown value', async () => {
    const { posted } = mockApi()
    renderPage()
    const user = await openForm()
    await screen.findByText('Custom fields')
    await pickSingle(user, 'Topic', 'Category B')
    expect(within(fieldRow('Topic')).getByRole('button')).toHaveTextContent('Category B')
    await submit(user)
    await waitFor(() => expect(posted).toHaveLength(1))
    expect(posted[0].customFields).toEqual({ 'f-single': 'Category B' })
  })

  it('does not send a single-select dropdown set back to "Not set"', async () => {
    const { posted } = mockApi()
    renderPage()
    const user = await openForm()
    await screen.findByText('Custom fields')
    await pickSingle(user, 'Topic', 'Category B')
    await pickSingle(user, 'Topic', 'Not set')
    await submit(user)
    await waitFor(() => expect(posted).toHaveLength(1))
    expect(posted[0]).not.toHaveProperty('customFields')
  })

  it('sends several multi-select dropdown values as an array', async () => {
    const { posted } = mockApi()
    renderPage()
    const user = await openForm()
    await screen.findByText('Custom fields')
    await pickMulti(user, 'Tags', ['Tag A', 'Tag C'])
    expect(within(fieldRow('Tags')).getByRole('button')).toHaveTextContent('Tag A, Tag C')
    await submit(user)
    await waitFor(() => expect(posted).toHaveLength(1))
    expect(posted[0].customFields).toEqual({ 'f-multi': ['Tag A', 'Tag C'] })
  })

  it('sends every field type together, alongside the main fields', async () => {
    const { posted } = mockApi()
    renderPage()
    const user = await openForm()
    await screen.findByText('Custom fields')
    await user.type(screen.getByLabelText(/^title$/i), 'A draft')
    await setText(user, 'Notes field', 'Some notes')
    fireEvent.change(screen.getByLabelText('Due date'), { target: { value: '2027-01-15' } })
    await user.click(screen.getByRole('checkbox', { name: 'Reviewed' }))
    await pickSingle(user, 'Topic', 'Category A')
    await pickMulti(user, 'Tags', ['Tag B'])
    await submit(user)
    await waitFor(() => expect(posted).toHaveLength(1))
    expect(posted[0]).toMatchObject({
      title: 'A draft',
      billNumber: 'D1',
      customFields: {
        'f-text': '<p>Some notes</p>',
        'f-date': '2027-01-15',
        'f-binary': '1',
        'f-single': 'Category A',
        'f-multi': ['Tag B'],
      },
    })
  })

  it('saves nothing until Create draft is clicked', async () => {
    const { spy } = mockApi()
    renderPage()
    const user = await openForm()
    await screen.findByText('Custom fields')
    await setText(user, 'Notes field', 'Some notes')
    fireEvent.change(screen.getByLabelText('Due date'), { target: { value: '2027-01-15' } })
    await user.click(screen.getByRole('checkbox', { name: 'Reviewed' }))
    await pickSingle(user, 'Topic', 'Category A')
    await pickMulti(user, 'Tags', ['Tag B'])
    const writes = spy.mock.calls.filter(([, init]) => init?.method && init.method !== 'GET')
    expect(writes).toEqual([])
  })
})

describe('DraftBills create form: custom fields reset', () => {
  beforeEach(() => vi.restoreAllMocks())

  async function fillAll(user: ReturnType<typeof userEvent.setup>) {
    await setText(user, 'Notes field', 'Some notes')
    fireEvent.change(screen.getByLabelText('Due date'), { target: { value: '2027-01-15' } })
    await user.click(screen.getByRole('checkbox', { name: 'Reviewed' }))
    await pickSingle(user, 'Topic', 'Category A')
    await pickMulti(user, 'Tags', ['Tag B'])
  }

  function expectAllBlank() {
    expect(within(fieldRow('Notes field')).getByRole('textbox')).toHaveValue('')
    expect(screen.getByLabelText('Due date')).toHaveValue('')
    expect(screen.getByRole('checkbox', { name: 'Reviewed' })).not.toBeChecked()
    expect(within(fieldRow('Topic')).getByRole('button')).toHaveTextContent('Not set')
    expect(within(fieldRow('Tags')).getByRole('button')).toHaveTextContent('Not set')
  }

  it('clears the custom field values after a successful create', async () => {
    const { posted } = mockApi()
    renderPage()
    const user = await openForm()
    await screen.findByText('Custom fields')
    await fillAll(user)
    await submit(user)
    await waitFor(() => expect(posted).toHaveLength(1))
    await waitFor(() => expect(screen.queryByRole('button', { name: /create draft/i })).not.toBeInTheDocument())

    await openForm(user)
    await screen.findByText('Custom fields')
    expectAllBlank()
  })

  it("does not carry one draft's values into the next draft's request", async () => {
    const { posted } = mockApi()
    renderPage()
    const user = await openForm()
    await screen.findByText('Custom fields')
    await fillAll(user)
    await submit(user)
    await waitFor(() => expect(posted).toHaveLength(1))

    await openForm(user)
    await screen.findByText('Custom fields')
    await submit(user)
    await waitFor(() => expect(posted).toHaveLength(2))
    expect(posted[1]).not.toHaveProperty('customFields')
  })

  it('clears the custom field values on Cancel', async () => {
    mockApi()
    renderPage()
    const user = await openForm()
    await screen.findByText('Custom fields')
    await fillAll(user)
    await user.click(screen.getByRole('button', { name: /^cancel$/i }))

    await openForm(user)
    await screen.findByText('Custom fields')
    expectAllBlank()
  })

  it('keeps the values after a failed create so the admin can correct and resubmit', async () => {
    const { posted } = mockApi({ createFails: true })
    renderPage()
    const user = await openForm()
    await screen.findByText('Custom fields')
    await user.click(screen.getByRole('checkbox', { name: 'Reviewed' }))
    await pickSingle(user, 'Topic', 'Category A')
    await submit(user)
    await waitFor(() => expect(posted).toHaveLength(1))

    expect(await screen.findByText('invalid_options')).toBeInTheDocument()
    expect(screen.getByRole('checkbox', { name: 'Reviewed' })).toBeChecked()
    expect(within(fieldRow('Topic')).getByRole('button')).toHaveTextContent('Category A')
  })
})
