/**
 * Retry policy and backoff logic
 */

import { ProviderError } from '../providers/types';

/**
 * Retry configuration
 */
export interface RetryConfig {
  maxRetries: number;
  initialBackoffMs: number;
  timeoutMs: number;
}

/**
 * Default retry configuration
 */
export const DEFAULT_RETRY_CONFIG: RetryConfig = {
  maxRetries: 2, // Total of 3 attempts (1 initial + 2 retries)
  initialBackoffMs: 200,
  timeoutMs: 2000,
};

/**
 * Calculate backoff delay for a retry attempt
 * Uses exponential backoff: initialBackoff * 2^attempt
 *
 * @param attempt - The retry attempt number (0-indexed)
 * @param initialBackoffMs - Initial backoff in milliseconds
 * @param retryAfterMs - Optional explicit retry-after from provider (for 429 errors)
 * @returns Delay in milliseconds
 */
export function calculateBackoff(
  attempt: number,
  initialBackoffMs: number,
  retryAfterMs?: number
): number {
  // If provider specifies retryAfter, use that
  if (retryAfterMs !== undefined && retryAfterMs > 0) {
    return retryAfterMs;
  }

  // Exponential backoff: initialBackoff * 2^attempt
  // attempt 0: 200ms
  // attempt 1: 400ms
  // attempt 2: 800ms
  const backoff = initialBackoffMs * Math.pow(2, attempt);

  // Add jitter (±10%) to avoid thundering herd
  const jitter = backoff * 0.1 * (Math.random() * 2 - 1);

  return Math.floor(backoff + jitter);
}

/**
 * Check if an error is retryable
 *
 * @param error - The error to check
 * @returns true if the error should be retried
 */
export function isRetryableError(error: unknown): boolean {
  if (error instanceof ProviderError) {
    return error.isRetryable();
  }

  // Retry on timeout errors
  if (error instanceof Error && error.name === 'TimeoutError') {
    return true;
  }

  // Don't retry unknown errors
  return false;
}

/**
 * Sleep utility
 *
 * @param ms - Milliseconds to sleep
 */
export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Timeout wrapper
 * Wraps a promise with a timeout
 *
 * @param promise - The promise to wrap
 * @param timeoutMs - Timeout in milliseconds
 * @param errorMessage - Error message for timeout
 * @returns Promise that rejects with TimeoutError if timeout is reached
 */
export async function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  errorMessage = 'Operation timed out'
): Promise<T> {
  let timeoutHandle: NodeJS.Timeout;

  const timeoutPromise = new Promise<never>((_, reject) => {
    timeoutHandle = setTimeout(() => {
      const error = new ProviderError(errorMessage, 504, 'TIMEOUT');
      reject(error);
    }, timeoutMs);
  });

  try {
    const result = await Promise.race([promise, timeoutPromise]);
    clearTimeout(timeoutHandle!);
    return result;
  } catch (error) {
    clearTimeout(timeoutHandle!);
    throw error;
  }
}

/**
 * Get retry-after delay from ProviderError
 *
 * @param error - The error
 * @returns Retry-after delay in ms, or undefined
 */
export function getRetryAfter(error: unknown): number | undefined {
  if (error instanceof ProviderError) {
    return error.retryAfterMs;
  }
  return undefined;
}
