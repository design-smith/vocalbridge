import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  calculateBackoff,
  isRetryableError,
  withTimeout,
  getRetryAfter,
  DEFAULT_RETRY_CONFIG,
} from '../../src/reliability/retryPolicy';
import { ProviderError } from '../../src/providers/types';

describe('Retry Policy', () => {
  describe('calculateBackoff', () => {
    it('should calculate exponential backoff', () => {
      const initialBackoff = 200;

      // Attempt 0: 200ms (base)
      const backoff0 = calculateBackoff(0, initialBackoff);
      expect(backoff0).toBeGreaterThanOrEqual(180); // 200 - 10% jitter
      expect(backoff0).toBeLessThanOrEqual(220); // 200 + 10% jitter

      // Attempt 1: 400ms (200 * 2^1)
      const backoff1 = calculateBackoff(1, initialBackoff);
      expect(backoff1).toBeGreaterThanOrEqual(360);
      expect(backoff1).toBeLessThanOrEqual(440);

      // Attempt 2: 800ms (200 * 2^2)
      const backoff2 = calculateBackoff(2, initialBackoff);
      expect(backoff2).toBeGreaterThanOrEqual(720);
      expect(backoff2).toBeLessThanOrEqual(880);
    });

    it('should respect retryAfterMs when provided', () => {
      const backoff = calculateBackoff(0, 200, 1500);
      expect(backoff).toBe(1500);
    });

    it('should prefer retryAfterMs over exponential backoff', () => {
      const backoff = calculateBackoff(5, 200, 100);
      expect(backoff).toBe(100);
    });

    it('should handle zero retryAfterMs', () => {
      const backoff = calculateBackoff(1, 200, 0);
      // Should fall back to exponential backoff
      expect(backoff).toBeGreaterThanOrEqual(360);
      expect(backoff).toBeLessThanOrEqual(440);
    });
  });

  describe('isRetryableError', () => {
    it('should identify 5xx errors as retryable', () => {
      const error = new ProviderError('Server error', 500, 'SERVER_ERROR');
      expect(isRetryableError(error)).toBe(true);
    });

    it('should identify 429 errors as retryable', () => {
      const error = new ProviderError('Rate limit', 429, 'RATE_LIMIT');
      expect(isRetryableError(error)).toBe(true);
    });

    it('should identify timeout errors as retryable', () => {
      const error = new ProviderError('Timeout', 504, 'TIMEOUT');
      expect(isRetryableError(error)).toBe(true);
    });

    it('should not retry 4xx errors (except 429)', () => {
      const error400 = new ProviderError('Bad request', 400, 'BAD_REQUEST');
      const error404 = new ProviderError('Not found', 404, 'NOT_FOUND');

      expect(isRetryableError(error400)).toBe(false);
      expect(isRetryableError(error404)).toBe(false);
    });

    it('should handle timeout errors by name', () => {
      const error = new Error('Timeout');
      error.name = 'TimeoutError';
      expect(isRetryableError(error)).toBe(true);
    });

    it('should not retry unknown errors', () => {
      const error = new Error('Unknown error');
      expect(isRetryableError(error)).toBe(false);
    });

    it('should not retry non-error values', () => {
      expect(isRetryableError('string')).toBe(false);
      expect(isRetryableError(null)).toBe(false);
      expect(isRetryableError(undefined)).toBe(false);
    });
  });

  describe('withTimeout', () => {
    it('should resolve if promise completes within timeout', async () => {
      const promise = new Promise<string>((resolve) => {
        setTimeout(() => resolve('success'), 50);
      });

      const result = await withTimeout(promise, 200);
      expect(result).toBe('success');
    });

    it('should reject with TimeoutError if timeout is exceeded', async () => {
      const promise = new Promise<string>((resolve) => {
        setTimeout(() => resolve('success'), 500);
      });

      await expect(withTimeout(promise, 100)).rejects.toThrow(ProviderError);
      await expect(withTimeout(promise, 100)).rejects.toThrow('Operation timed out');
    });

    it('should use custom error message', async () => {
      const promise = new Promise<string>((resolve) => {
        setTimeout(() => resolve('success'), 500);
      });

      await expect(
        withTimeout(promise, 100, 'Custom timeout message')
      ).rejects.toThrow('Custom timeout message');
    });

    it('should reject with original error if promise rejects', async () => {
      const promise = new Promise<string>((_, reject) => {
        setTimeout(() => reject(new Error('Original error')), 50);
      });

      await expect(withTimeout(promise, 200)).rejects.toThrow('Original error');
    });

    it('timeout error should have TIMEOUT error code', async () => {
      const promise = new Promise<string>((resolve) => {
        setTimeout(() => resolve('success'), 500);
      });

      try {
        await withTimeout(promise, 100);
        expect.fail('Should have thrown');
      } catch (error) {
        expect(error).toBeInstanceOf(ProviderError);
        if (error instanceof ProviderError) {
          expect(error.errorCode).toBe('TIMEOUT');
          expect(error.statusCode).toBe(504);
        }
      }
    });
  });

  describe('getRetryAfter', () => {
    it('should extract retryAfterMs from ProviderError', () => {
      const error = new ProviderError('Rate limit', 429, 'RATE_LIMIT', 1000);
      expect(getRetryAfter(error)).toBe(1000);
    });

    it('should return undefined if no retryAfterMs', () => {
      const error = new ProviderError('Server error', 500, 'SERVER_ERROR');
      expect(getRetryAfter(error)).toBeUndefined();
    });

    it('should return undefined for non-ProviderError', () => {
      const error = new Error('Some error');
      expect(getRetryAfter(error)).toBeUndefined();
    });
  });

  describe('DEFAULT_RETRY_CONFIG', () => {
    it('should have correct default values', () => {
      expect(DEFAULT_RETRY_CONFIG.maxRetries).toBe(2);
      expect(DEFAULT_RETRY_CONFIG.initialBackoffMs).toBe(200);
      expect(DEFAULT_RETRY_CONFIG.timeoutMs).toBe(2000);
    });
  });

  describe('Backoff progression', () => {
    it('should increase exponentially across attempts', () => {
      const backoffs = [
        calculateBackoff(0, 200),
        calculateBackoff(1, 200),
        calculateBackoff(2, 200),
      ];

      // Each backoff should be roughly double the previous (accounting for jitter)
      // We can't test exact values due to jitter, but we can verify general progression
      expect(backoffs[1]).toBeGreaterThan(backoffs[0]);
      expect(backoffs[2]).toBeGreaterThan(backoffs[1]);

      // Verify rough doubling (within jitter tolerance)
      expect(backoffs[1] / backoffs[0]).toBeGreaterThan(1.6); // Should be ~2
      expect(backoffs[1] / backoffs[0]).toBeLessThan(2.4);

      expect(backoffs[2] / backoffs[1]).toBeGreaterThan(1.6); // Should be ~2
      expect(backoffs[2] / backoffs[1]).toBeLessThan(2.4);
    });
  });
});
