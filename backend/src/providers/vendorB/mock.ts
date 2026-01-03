/**
 * VendorB Mock Implementation
 * Simulates VendorB's behavior with rate limiting and latency
 */

import { ProviderRequest } from '../types';

/**
 * VendorB's raw response schema (OpenAI-like)
 */
export interface VendorBResponse {
  choices: Array<{
    message: {
      content: string;
    };
  }>;
  usage: {
    input_tokens: number;
    output_tokens: number;
  };
}

/**
 * VendorB mock error
 */
export class VendorBError extends Error {
  constructor(
    message: string,
    public readonly statusCode: number,
    public readonly retryAfterMs?: number
  ) {
    super(message);
    this.name = 'VendorBError';
  }
}

/**
 * Mock VendorB provider
 * Simulates:
 * - Occasional 429 rate limit errors with retryAfterMs
 * - Random latency
 */
export class VendorBMock {
  private rateLimitChance: number;

  constructor(rateLimitChance = 0.05) {
    this.rateLimitChance = rateLimitChance;
  }

  /**
   * Simulate a call to VendorB
   * @param request - The provider request
   * @returns VendorB response
   * @throws VendorBError on simulated failure
   */
  async call(request: ProviderRequest): Promise<VendorBResponse> {
    // Simulate network latency
    const baseLatency = Math.random() * 200 + 100; // 100-300ms
    const spikeChance = Math.random();
    const latency =
      spikeChance < 0.03 ? baseLatency * 4 : baseLatency; // 3% chance of 4x latency spike

    await this.sleep(latency);

    // Simulate rate limiting (~5% chance)
    if (Math.random() < this.rateLimitChance) {
      const retryAfterMs = Math.floor(Math.random() * 2000 + 500); // 500-2500ms
      throw new VendorBError(
        'Rate limit exceeded',
        429,
        retryAfterMs
      );
    }

    // Generate mock response
    const userMessage =
      request.messages.length > 0
        ? request.messages[request.messages.length - 1].content
        : '';

    const responseText = this.generateMockResponse(userMessage);

    const response: VendorBResponse = {
      choices: [
        {
          message: {
            content: responseText,
          },
        },
      ],
      usage: {
        input_tokens: this.estimateTokens(
          request.systemPrompt +
            request.messages.map((m) => m.content).join(' ')
        ),
        output_tokens: this.estimateTokens(responseText),
      },
    };

    return response;
  }

  /**
   * Generate a mock response based on user input
   */
  private generateMockResponse(userMessage: string): string {
    const responses = [
      `I've received your message: "${userMessage}". Here's my response...`,
      `Analyzing your query: "${userMessage}". Based on that, I would say...`,
      `Thank you for asking about: "${userMessage}". Let me explain...`,
      `Your question "${userMessage}" is interesting. Here's what I think...`,
      `Regarding "${userMessage}", I can provide the following information...`,
    ];

    return responses[Math.floor(Math.random() * responses.length)];
  }

  /**
   * Estimate token count (rough approximation: 1 token ≈ 4 characters)
   */
  private estimateTokens(text: string): number {
    return Math.ceil(text.length / 4);
  }

  /**
   * Sleep utility
   */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
