import { useId, type ReactNode } from 'react'
import { HoverTooltip } from './HoverTooltip'
import { SR_ONLY } from '../lib/textStyles'

/**
 * A plain hover on a legislative or data term (a status, an event type, a
 * provider's field label), opening below with no ⓘ. `InfoTooltip` is for
 * explaining how FloorVote works; this is for explaining the term itself.
 *
 * The bubble is for pointers and focus. The same text sits in a visually
 * hidden span the term points to through aria-describedby, so screen readers
 * get it too. Renders its children unchanged when there is no text.
 *
 * `interactive`: the children are already focusable (a button), so no extra
 * tab stop is added; give them `aria-describedby={id}` with the same `id`.
 */
export function TermHover({ text, id: givenId, interactive = false, children }: { text?: string | null; id?: string; interactive?: boolean; children: ReactNode }) {
  const generated = useId()
  const id = givenId ?? generated
  if (!text) return <>{children}</>
  return (
    <>
      <HoverTooltip text={text} placement="bottom" maxWidth={320}>
        {interactive ? children : (
          // Focusable on purpose: keyboard users reach the explainer by focusing the term.
          // eslint-disable-next-line jsx-a11y/no-noninteractive-tabindex
          <span tabIndex={0} aria-describedby={id}>{children}</span>
        )}
      </HoverTooltip>
      <span id={id} style={SR_ONLY}>{text}</span>
    </>
  )
}
