/**
 * VendorA Adapter
 * Implements ProviderAdapter interface for VendorA
 */

import {
  ProviderAdapter,
  ProviderRequest,
  NormalizedResponse,
  ProviderError,
} from '../types';
import { VendorAMock, VendorAError } from './mock';

/**
 * VendorA adapter implementation
 */
export class VendorAAdapter implements ProviderAdapter {
  readonly name = 'vendorA';
  private mock: VendorAMock;

  constructor(failureRate?: number) {
    this.mock = new VendorAMock(failureRate);
  }

  /**
   * Call VendorA and normalize the response
   * @param request - The provider request
   * @returns Normalized response
   * @throws ProviderError on failure
   */
  async call(request: ProviderRequest): Promise<NormalizedResponse> {
    try {
      const response = await this.mock.call(request);

      // Normalize VendorA response to our standard format
      return {
        text: response.outputText,
        tokensIn: response.tokensIn,
        tokensOut: response.tokensOut,
        latencyMs: response.latencyMs,
      };
    } catch (error) {
      if (error instanceof VendorAError) {
        // Convert VendorA error to ProviderError
        throw new ProviderError(
          error.message,
          error.statusCode,
          'SERVER_ERROR'
        );
      }

      // Unexpected error
      throw new ProviderError(
        'Unknown error calling VendorA',
        500,
        'UNKNOWN_ERROR'
      );
    }
  }
}
