import { createHash } from 'crypto';

/**
 * Hash an API key using SHA-256
 * API keys should never be stored in plaintext
 *
 * @param apiKey - The raw API key to hash
 * @returns The SHA-256 hash of the API key
 */
export function hashApiKey(apiKey: string): string {
  return createHash('sha256').update(apiKey).digest('hex');
}

/**
 * Compute a request hash for idempotency verification
 * This helps detect if the same idempotency key is reused with different request data
 *
 * @param data - Object containing request parameters
 * @returns SHA-256 hash of the request data
 */
export function computeRequestHash(data: {
  tenantId: string;
  sessionId: string;
  content: string;
  timestamp?: string;
}): string {
  const payload = JSON.stringify({
    tenantId: data.tenantId,
    sessionId: data.sessionId,
    content: data.content,
    timestamp: data.timestamp || new Date().toISOString(),
  });

  return createHash('sha256').update(payload).digest('hex');
}

/**
 * Generate a random API key
 * Format: 32 random bytes encoded as hex (64 characters)
 *
 * @returns A new random API key
 */
export function generateApiKey(): string {
  const randomBytes = createHash('sha256')
    .update(Math.random().toString())
    .update(Date.now().toString())
    .digest('hex');

  return randomBytes;
}
