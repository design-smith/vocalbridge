/**
 * Generate a unique idempotency key
 * Format: timestamp-randomstring
 */
export function generateIdempotencyKey(): string {
  const timestamp = Date.now()
  const random = Math.random().toString(36).substring(2, 15)
  return `${timestamp}-${random}`
}

/**
 * Generate a client message ID
 */
export function generateClientMessageId(): string {
  return `msg-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`
}
