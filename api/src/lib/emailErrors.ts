/**
 * A send that failed because of the recipient address, not the provider:
 * retrying it later or through the other provider cannot succeed. The invite
 * queue consumer acks on this instead of retrying.
 *
 * Lives apart from email.ts so callers can `instanceof` it even when a test
 * mocks the email module wholesale.
 */
export class PermanentSendError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'PermanentSendError'
  }
}
