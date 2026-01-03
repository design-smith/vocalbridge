/**
 * VendorB Adapter
 * Implements ProviderAdapter interface for VendorB
 */

import {
  ProviderAdapter,
  ProviderRequest,
  NormalizedResponse,
  ProviderError,
} from '../types';
import { VendorBMock, VendorBError } from './mock';

/**
 * VendorB adapter implementation
 */
export class VendorBAdapter implements ProviderAdapter {
  readonly name = 'vendorB';
  private mock: VendorBMock;

  constructor(rateLimitChance?: number) {
    this.mock = new VendorBMock(rateLimitChance);
  }

  /**
   * Call VendorB and normalize the response
   * @param request - The provider request
   * @returns Normalized response
   * @throws ProviderError on failure
   */
  async call(request: ProviderRequest): Promise<NormalizedResponse> {
    const startTime = Date.now();

    try {
      const response = await this.mock.call(request);

      // Normalize VendorB response (OpenAI-like) to our standard format
      const text = response.choices[0]?.message?.content || '';

      return {
        text,
        tokensIn: response.usage.input_tokens,
        tokensOut: response.usage.output_tokens,
        latencyMs: Date.now() - startTime,
      };
    } catch (error) {
      if (error instanceof VendorBError) {
        // Convert VendorB error to ProviderError
        const errorCode = error.statusCode === 429 ? 'RATE_LIMIT' : 'SERVER_ERROR';

        throw new ProviderError(
          error.message,
          error.statusCode,
          errorCode,
          error.retryAfterMs
        );
      }

      // Unexpected error
      throw new ProviderError(
        'Unknown error calling VendorB',
        500,
        'UNKNOWN_ERROR'
      );
    }
  }
}
