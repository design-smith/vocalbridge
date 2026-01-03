import { describe, it, expect } from 'vitest';
import { VendorAAdapter } from '../../src/providers/vendorA/adapter';
import { VendorBAdapter } from '../../src/providers/vendorB/adapter';
import { ProviderRequest, ProviderError } from '../../src/providers/types';

describe('Provider Adapters', () => {
  const mockRequest: ProviderRequest = {
    systemPrompt: 'You are a helpful assistant.',
    messages: [
      { role: 'user', content: 'Hello, how are you?' },
    ],
    enabledTools: [],
  };

  describe('VendorA Adapter', () => {
    it('should normalize VendorA response correctly', async () => {
      // Use 0 failure rate for deterministic testing
      const adapter = new VendorAAdapter(0);
      const response = await adapter.call(mockRequest);

      expect(response).toHaveProperty('text');
      expect(response).toHaveProperty('tokensIn');
      expect(response).toHaveProperty('tokensOut');
      expect(response).toHaveProperty('latencyMs');

      expect(typeof response.text).toBe('string');
      expect(typeof response.tokensIn).toBe('number');
      expect(typeof response.tokensOut).toBe('number');
      expect(typeof response.latencyMs).toBe('number');

      expect(response.text.length).toBeGreaterThan(0);
      expect(response.tokensIn).toBeGreaterThan(0);
      expect(response.tokensOut).toBeGreaterThan(0);
      expect(response.latencyMs).toBeGreaterThan(0);
    });

    it('should have correct adapter name', () => {
      const adapter = new VendorAAdapter();
      expect(adapter.name).toBe('vendorA');
    });

    it('should throw ProviderError on failure', async () => {
      // Use 100% failure rate to ensure error
      const adapter = new VendorAAdapter(1.0);

      await expect(adapter.call(mockRequest)).rejects.toThrow(ProviderError);
    });

    it('should include error code in ProviderError', async () => {
      const adapter = new VendorAAdapter(1.0);

      try {
        await adapter.call(mockRequest);
        expect.fail('Should have thrown ProviderError');
      } catch (error) {
        expect(error).toBeInstanceOf(ProviderError);
        if (error instanceof ProviderError) {
          expect(error.errorCode).toBe('SERVER_ERROR');
          expect(error.statusCode).toBe(500);
        }
      }
    });

    it('should handle multiple messages', async () => {
      const adapter = new VendorAAdapter(0);
      const multiMessageRequest: ProviderRequest = {
        systemPrompt: 'You are a helpful assistant.',
        messages: [
          { role: 'user', content: 'First message' },
          { role: 'assistant', content: 'First response' },
          { role: 'user', content: 'Second message' },
        ],
      };

      const response = await adapter.call(multiMessageRequest);
      expect(response.text).toBeTruthy();
    });
  });

  describe('VendorB Adapter', () => {
    it('should normalize VendorB response correctly', async () => {
      // Use 0 rate limit chance for deterministic testing
      const adapter = new VendorBAdapter(0);
      const response = await adapter.call(mockRequest);

      expect(response).toHaveProperty('text');
      expect(response).toHaveProperty('tokensIn');
      expect(response).toHaveProperty('tokensOut');
      expect(response).toHaveProperty('latencyMs');

      expect(typeof response.text).toBe('string');
      expect(typeof response.tokensIn).toBe('number');
      expect(typeof response.tokensOut).toBe('number');
      expect(typeof response.latencyMs).toBe('number');

      expect(response.text.length).toBeGreaterThan(0);
      expect(response.tokensIn).toBeGreaterThan(0);
      expect(response.tokensOut).toBeGreaterThan(0);
      expect(response.latencyMs).toBeGreaterThan(0);
    });

    it('should have correct adapter name', () => {
      const adapter = new VendorBAdapter();
      expect(adapter.name).toBe('vendorB');
    });

    it('should throw ProviderError with retryAfterMs on rate limit', async () => {
      // Use 100% rate limit chance to ensure error
      const adapter = new VendorBAdapter(1.0);

      try {
        await adapter.call(mockRequest);
        expect.fail('Should have thrown ProviderError');
      } catch (error) {
        expect(error).toBeInstanceOf(ProviderError);
        if (error instanceof ProviderError) {
          expect(error.errorCode).toBe('RATE_LIMIT');
          expect(error.statusCode).toBe(429);
          expect(error.retryAfterMs).toBeDefined();
          expect(error.retryAfterMs).toBeGreaterThan(0);
          expect(error.isRateLimit()).toBe(true);
          expect(error.isRetryable()).toBe(true);
        }
      }
    });

    it('should handle multiple messages', async () => {
      const adapter = new VendorBAdapter(0);
      const multiMessageRequest: ProviderRequest = {
        systemPrompt: 'You are a helpful assistant.',
        messages: [
          { role: 'user', content: 'First message' },
          { role: 'assistant', content: 'First response' },
          { role: 'user', content: 'Second message' },
        ],
      };

      const response = await adapter.call(multiMessageRequest);
      expect(response.text).toBeTruthy();
    });
  });

  describe('Response Normalization', () => {
    it('both adapters should return same structure', async () => {
      const vendorA = new VendorAAdapter(0);
      const vendorB = new VendorBAdapter(0);

      const responseA = await vendorA.call(mockRequest);
      const responseB = await vendorB.call(mockRequest);

      // Both should have the same properties
      expect(Object.keys(responseA).sort()).toEqual(
        Object.keys(responseB).sort()
      );

      // Both should have the same types
      expect(typeof responseA.text).toBe(typeof responseB.text);
      expect(typeof responseA.tokensIn).toBe(typeof responseB.tokensIn);
      expect(typeof responseA.tokensOut).toBe(typeof responseB.tokensOut);
      expect(typeof responseA.latencyMs).toBe(typeof responseB.latencyMs);
    });

    it('token counts should be reasonable', async () => {
      const adapter = new VendorAAdapter(0);
      const response = await adapter.call(mockRequest);

      // Token counts should be positive and reasonable
      expect(response.tokensIn).toBeGreaterThan(0);
      expect(response.tokensIn).toBeLessThan(10000);
      expect(response.tokensOut).toBeGreaterThan(0);
      expect(response.tokensOut).toBeLessThan(10000);
    });
  });

  describe('ProviderError', () => {
    it('should correctly identify retryable errors', () => {
      const error500 = new ProviderError('Server error', 500, 'SERVER_ERROR');
      const error429 = new ProviderError('Rate limit', 429, 'RATE_LIMIT');
      const error400 = new ProviderError('Bad request', 400, 'BAD_REQUEST');

      expect(error500.isRetryable()).toBe(true);
      expect(error429.isRetryable()).toBe(true);
      expect(error400.isRetryable()).toBe(false);
    });

    it('should correctly identify rate limit errors', () => {
      const error429 = new ProviderError('Rate limit', 429, 'RATE_LIMIT');
      const error500 = new ProviderError('Server error', 500, 'SERVER_ERROR');

      expect(error429.isRateLimit()).toBe(true);
      expect(error500.isRateLimit()).toBe(false);
    });

    it('should store retryAfterMs', () => {
      const error = new ProviderError('Rate limit', 429, 'RATE_LIMIT', 1000);
      expect(error.retryAfterMs).toBe(1000);
    });
  });
});
