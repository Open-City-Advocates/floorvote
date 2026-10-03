import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import React from 'react'
import { MemoryRouter } from 'react-router-dom'
import type { CalendarEvent } from '../../lib/calendarGrid'

// The required-field pattern on the calendar event form (create and edit):
// Title and Date are required. The Save button explains itself with
// "Missing a required field (*)" while either is missing.

const { demo } = vi.hoisted(() => ({ demo: { demoMode: false, demoLocked: false } }))
vi.mock('../../context/DemoContext', () => ({ useDemo: () => demo }))
vi.mock('../BillPicker', () => ({ BillPicker: () => React.createElement('div', { 'data-testid': 'bill-picker' }) }))

import { EventFormFields, type EventFormValues } from './EventFormFields'
import { EventForm } from './EventForm'
import { EventItem } from './EventItem'

const REASON = 'Missing a required field (*)'

const VALID: EventFormValues = {
  description: 'Board meeting', date: '2099-01-01', time: null, location: null, billIds: [], details: null, url: null,
}

function renderFields(initial?: EventFormValues) {
  const onSave = vi.fn()
  render(<EventFormFields initial={initial} billOptions={[]} multiState={false} onSave={onSave} onClose={() => {}} />)
  return { onSave }
}

const saveButton = () => screen.getByRole('button', { name: /^save$/i })
const reason = () => screen.queryByText('Missing a required field')
const title = () => screen.getByLabelText(/^title/i)
const date = () => screen.getByLabelText(/^date/i)

beforeEach(() => { demo.demoLocked = false })

describe('EventFormFields required fields', () => {
  it('shows a "* Required" legend', () => {
    renderFields()
    expect(screen.getByText('Required').parentElement).toHaveTextContent('* Required')
  })

  it('marks Title and Date with aria-required and a red asterisk', () => {
    renderFields()
    expect(title()).toHaveAttribute('aria-required', 'true')
    expect(date()).toHaveAttribute('aria-required', 'true')
    expect(title().closest('label')).toHaveTextContent('Title *')
    expect(date().closest('label')).toHaveTextContent('Date *')
  })

  it('does not mark the optional fields as required', () => {
    renderFields()
    for (const label of [/^time/i, /^description/i, /^link$/i]) {
      expect(screen.getByLabelText(label)).not.toHaveAttribute('aria-required')
    }
  })

  it('shows the reason beside the disabled Save button on an empty form', () => {
    renderFields()
    expect(saveButton()).toBeDisabled()
    expect(reason()?.closest('[id]')).toHaveTextContent(REASON)
    expect(saveButton()).toHaveAccessibleDescription('Missing a required field')
  })

  it('keeps the reason while only Title is filled', async () => {
    const user = userEvent.setup()
    renderFields()
    await user.type(title(), 'Hearing')
    expect(saveButton()).toBeDisabled()
    expect(reason()).toBeInTheDocument()
  })

  it('keeps the reason while only Date is filled', () => {
    renderFields()
    fireEvent.change(date(), { target: { value: '2099-01-01' } })
    expect(saveButton()).toBeDisabled()
    expect(reason()).toBeInTheDocument()
  })

  it('hides the reason once Title and Date are both filled', async () => {
    const user = userEvent.setup()
    renderFields()
    await user.type(title(), 'Hearing')
    fireEvent.change(date(), { target: { value: '2099-01-01' } })
    expect(saveButton()).toBeEnabled()
    expect(reason()).not.toBeInTheDocument()
    expect(saveButton()).not.toHaveAttribute('aria-describedby')
  })

  it('brings the reason back when Title is cleared', async () => {
    const user = userEvent.setup()
    renderFields(VALID)
    expect(reason()).not.toBeInTheDocument()
    await user.clear(title())
    expect(saveButton()).toBeDisabled()
    expect(reason()).toBeInTheDocument()
  })

  it('brings the reason back when Date is cleared', () => {
    renderFields(VALID)
    fireEvent.change(date(), { target: { value: '' } })
    expect(saveButton()).toBeDisabled()
    expect(reason()).toBeInTheDocument()
  })

  it('treats a whitespace-only Title as missing', async () => {
    const user = userEvent.setup()
    renderFields({ ...VALID, description: '' })
    await user.type(title(), '   ')
    expect(saveButton()).toBeDisabled()
    expect(reason()).toBeInTheDocument()
  })

  it('does not save a missing Title on Enter', async () => {
    const user = userEvent.setup()
    const { onSave } = renderFields({ ...VALID, description: '' })
    await user.type(title(), '  {Enter}')
    expect(onSave).not.toHaveBeenCalled()
  })

  it('does not show the reason when the button is disabled only by demo lock', () => {
    demo.demoLocked = true
    renderFields(VALID)
    expect(saveButton()).toBeDisabled()
    expect(reason()).not.toBeInTheDocument()
    expect(saveButton()).not.toHaveAttribute('aria-describedby')
  })

  it('does not show the reason under demo lock even while fields are missing', () => {
    demo.demoLocked = true
    renderFields()
    expect(saveButton()).toBeDisabled()
    expect(reason()).not.toBeInTheDocument()
  })

  it('does not show the reason when only an invalid link blocks Save, which has its own message', async () => {
    const user = userEvent.setup()
    renderFields(VALID)
    await user.type(screen.getByLabelText(/^link$/i), 'example.com')
    expect(saveButton()).toBeDisabled()
    expect(screen.getByText(/must start with http/i)).toBeInTheDocument()
    expect(reason()).not.toBeInTheDocument()
  })
})

describe('Calendar event required fields in both hosts', () => {
  const pos = { positionStyle: {}, transformOrigin: 'top left', enterOffsetY: -6 }

  it('the create popover shows the legend and reason', () => {
    render(<EventForm billOptions={[]} multiState={false} onSave={vi.fn()} onClose={vi.fn()} position={pos} />)
    expect(screen.getByText('Required')).toBeInTheDocument()
    expect(reason()).toBeInTheDocument()
    expect(saveButton()).toHaveAccessibleDescription('Missing a required field')
  })

  it('the inline edit form shows the reason once the title is cleared', async () => {
    const user = userEvent.setup()
    const event: CalendarEvent = {
      id: 'e1', uid: 'u', source: 'custom', billId: null, bills: [],
      date: '2099-01-01', time: null, location: null, description: 'Board meeting', details: null, url: null, status: 'confirmed',
    }
    render(
      <MemoryRouter>
        <EventItem
          event={event}
          isPast={false}
          isAdmin
          editing
          billOptions={[]}
          onEdit={vi.fn()}
          onEditSave={vi.fn()}
          onEditCancel={vi.fn()}
          onDelete={vi.fn()}
          onRestore={vi.fn()}
        />
      </MemoryRouter>,
    )
    expect(screen.getByText('Required')).toBeInTheDocument()
    expect(reason()).not.toBeInTheDocument()
    await user.clear(title())
    expect(reason()).toBeInTheDocument()
  })
})
