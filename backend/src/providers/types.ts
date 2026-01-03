/**
 * Provider adapter interface and types
 * Defines a unified interface for different AI providers
 */

/**
 * Request to an AI provider
 */
export interface ProviderRequest {
  systemPrompt: string;
  messages: Array<{
    role: 'user' | 'assistant';
    content: string;
  }>;
  enabledTools?: string[];
}

/**
 * Normalized response from any provider
 * All provider adapters must return this format
 */
export interface NormalizedResponse {
  text: string;
  tokensIn: number;
  tokensOut: number;
  latencyMs: number;
}

/**
 * Provider error with optional retry-after information
 */
export class ProviderError extends Error {
  constructor(
    message: string,
    public readonly statusCode: number,
    public readonly errorCode: string,
    public readonly retryAfterMs?: number
  ) {
    super(message);
    this.name = 'ProviderError';
  }

  /**
   * Check if this error is retryable
   */
  isRetryable(): boolean {
    // Retry on server errors (5xx) and rate limits (429)
    return this.statusCode >= 500 || this.statusCode === 429;
  }

  /**
   * Check if this is a rate limit error
   */
  isRateLimit(): boolean {
    return this.statusCode === 429;
  }

  /**
   * Check if this is a timeout error
   */
  isTimeout(): boolean {
    return this.errorCode === 'TIMEOUT';
  }
}

/**
 * Provider adapter interface
 * All providers must implement this interface
 */
export interface ProviderAdapter {
  /**
   * The name of the provider
   */
  readonly name: string;

  /**
   * Call the provider with a request
   * @param request - The provider request
   * @returns Normalized response
   * @throws ProviderError on failure
   */
  call(request: ProviderRequest): Promise<NormalizedResponse>;
}
