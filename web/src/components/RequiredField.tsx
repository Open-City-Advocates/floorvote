import { useCallback, useId, useState, type CSSProperties, type ReactNode } from 'react'
import { color, fontWeight } from '../styles/tokens'
import { FORM_LABEL, HELPER_TEXT } from '../lib/textStyles'

// The shared required-field pattern. A form with a required field:
//
//   1. renders <RequiredLegend /> at the top, so the asterisk has a stated meaning;
//   2. labels each required field with <RequiredLabel> (or puts <RequiredMarker />
//      in its own label) and sets aria-required on the field's input. A field
//      whose control is a button (a Picker trigger) cannot carry aria-required,
//      so it puts the requirement in its accessible name with requiredName();
//   3. gates its submit button with useRequiredSubmit(), passing the
//      missing-required check separately from every other disabled reason, and
//      renders <MissingRequiredReason {...gate.reasonProps} /> beside the button.
//
// The reason is visible text, not a tooltip: a natively disabled button gets no
// hover or focus events, and phones have no hover. The wording is generic on
// purpose and never names the missing fields.
//
// An inline editor (one value edited in place, saved with Enter or a Save
// button) that refuses a blank value is the other case. It keeps Save enabled
// and, on a blank save, stays open and says why: useBlankValueGuard() supplies
// the field's aria-required/aria-invalid/aria-describedby, and
// <BlankValueMessage {...guard.messageProps} name="..." /> renders
// "* <name> is required" beside the field as an alert, so a screen reader
// announces it the moment the save is refused. The message clears once the
// value is no longer blank, and on cancel or reopen (guard.reset()).

const MARK_STYLE: CSSProperties = { fontWeight: fontWeight.semibold, color: color.textDanger }

/**
 * The red asterisk. Hidden from assistive tech: aria-required (or
 * requiredName) carries the meaning, so a screen reader does not also read "star".
 */
export function RequiredMarker() {
  return <span aria-hidden="true" style={MARK_STYLE}>*</span>
}

/** A FORM_LABEL label with the required marker after its text. */
export function RequiredLabel({ htmlFor, children, style }: { htmlFor?: string; children: ReactNode; style?: CSSProperties }) {
  return (
    <label htmlFor={htmlFor} style={{ ...FORM_LABEL, ...style }}>
      {children} <RequiredMarker />
    </label>
  )
}

/** "* Required", shown at the top of a form that has at least one required field. */
export function RequiredLegend({ style }: { style?: CSSProperties }) {
  return (
    <div style={{ ...HELPER_TEXT, ...style }}>
      <RequiredMarker /> <span>Required</span>
    </div>
  )
}

/**
 * Accessible name for a required field whose control is a button (e.g. a
 * Picker trigger), which cannot carry aria-required.
 */
export function requiredName(name: string): string {
  return `${name} (required)`
}

/**
 * Visible "Missing a required field (*)" line for beside a disabled submit
 * button. Renders nothing unless `show`. Spread useRequiredSubmit's reasonProps.
 */
export function MissingRequiredReason({ id, show, style }: { id: string; show: boolean; style?: CSSProperties }) {
  if (!show) return null
  return (
    <div id={id} style={{ ...HELPER_TEXT, ...style }}>
      Missing a required field<span aria-hidden="true"> (<span style={MARK_STYLE}>*</span>)</span>
    </div>
  )
}

/**
 * Gate for a submit button.
 *
 * - `missingRequired`: true while any required value is missing.
 * - `blocked`: true while the button is disabled for any other reason
 *   (demo lock, a request in flight, ...).
 *
 * The button is disabled when either holds. The reason shows only when the
 * missing value is what stands in the way: not while `blocked`, since filling
 * the field would not enable the button then.
 *
 *   const gate = useRequiredSubmit({ missingRequired: !name.trim(), blocked: saving || demoLocked })
 *   <button {...gate.buttonProps} style={actionBtnBlue(gate.disabled)}>Save</button>
 *   <MissingRequiredReason {...gate.reasonProps} />
 */
export function useRequiredSubmit({ missingRequired, blocked = false }: { missingRequired: boolean; blocked?: boolean }) {
  const id = useId()
  const disabled = missingRequired || blocked
  const show = missingRequired && !blocked
  return {
    disabled,
    buttonProps: { disabled, 'aria-describedby': show ? id : undefined },
    reasonProps: { id, show },
  }
}

/**
 * Guard for an inline editor that refuses a blank value.
 *
 *   const guard = useBlankValueGuard()
 *   // on open or cancel: guard.reset()
 *   // on save:           if (guard.refuse(value)) return
 *   <input {...guard.fieldProps} onChange={e => { setValue(e.target.value); guard.onValue(e.target.value) }} />
 *   <BlankValueMessage {...guard.messageProps} name="Role name" />
 *
 * A field whose control is a button (a Picker trigger), which cannot carry
 * aria-required or aria-invalid, spreads `triggerProps` instead and names
 * itself with requiredName().
 */
export function useBlankValueGuard() {
  const id = useId()
  const [shown, setShown] = useState(false)
  /** On save: true when `value` is blank, showing the message; the caller then saves nothing. */
  const refuse = useCallback((value: string): boolean => {
    const blank = !value.trim()
    setShown(blank)
    return blank
  }, [])
  /** On every change: hides the message once the value is no longer blank. */
  const onValue = useCallback((value: string) => {
    if (value.trim()) setShown(false)
  }, [])
  /** On opening or cancelling the editor. */
  const reset = useCallback(() => setShown(false), [])
  return {
    refuse,
    onValue,
    reset,
    fieldProps: {
      'aria-required': true,
      'aria-invalid': shown || undefined,
      'aria-describedby': shown ? id : undefined,
    },
    triggerProps: { 'aria-describedby': shown ? id : undefined },
    messageProps: { id, show: shown },
  } as const
}

/**
 * Inline "* <name> is required" for an editor that refused a blank save.
 * Renders nothing unless `show`. Spread useBlankValueGuard's messageProps.
 */
export function BlankValueMessage({ id, show, name, style }: { id: string; show: boolean; name: string; style?: CSSProperties }) {
  if (!show) return null
  return (
    <span id={id} role="alert" style={{ ...HELPER_TEXT, ...style }}>
      <RequiredMarker /> {name} is required
    </span>
  )
}
