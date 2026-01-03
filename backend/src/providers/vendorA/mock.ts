/**
 * VendorA Mock Implementation
 * Simulates VendorA's behavior with configurable failure rates and latency
 */

import { ProviderRequest } from '../types';

/**
 * VendorA's raw response schema
 */
export interface VendorAResponse {
  outputText: string;
  tokensIn: number;
  tokensOut: number;
  latencyMs: number;
}

/**
 * VendorA mock error
 */
export class VendorAError extends Error {
  constructor(
    message: string,
    public readonly statusCode: number
  ) {
    super(message);
    this.name = 'VendorAError';
  }
}

/**
 * Mock VendorA provider
 * Simulates:
 * - ~10% failure rate (HTTP 500)
 * - Random latency (50-300ms base, occasionally higher)
 */
export class VendorAMock {
  private failureRate: number;

  constructor(failureRate = 0.1) {
    this.failureRate = failureRate;
  }

  /**
   * Simulate a call to VendorA
   * @param request - The provider request
   * @returns VendorA response
   * @throws VendorAError on simulated failure
   */
  async call(request: ProviderRequest): Promise<VendorAResponse> {
    const startTime = Date.now();

    // Simulate network latency
    const baseLatency = Math.random() * 250 + 50; // 50-300ms
    const spikeChance = Math.random();
    const latency =
      spikeChance < 0.05 ? baseLatency * 3 : baseLatency; // 5% chance of 3x latency spike

    await this.sleep(latency);

    // Simulate random failures (~10%)
    if (Math.random() < this.failureRate) {
      throw new VendorAError('Internal server error', 500);
    }

    // Generate mock response
    const userMessage =
      request.messages.length > 0
        ? request.messages[request.messages.length - 1].content
        : '';

    const response: VendorAResponse = {
      outputText: this.generateMockResponse(userMessage),
      tokensIn: this.estimateTokens(
        request.systemPrompt +
          request.messages.map((m) => m.content).join(' ')
      ),
      tokensOut: this.estimateTokens(this.generateMockResponse(userMessage)),
      latencyMs: Date.now() - startTime,
    };

    return response;
  }

  /**
   * Generate a mock response based on user input
   */
  private generateMockResponse(userMessage: string): string {
    const responses = [
      `Thank you for your message: "${userMessage}". How can I assist you further?`,
      `I understand you said: "${userMessage}". Let me help you with that.`,
      `Regarding "${userMessage}", here's what I can tell you...`,
      `I've processed your request about: "${userMessage}". Here's the information you need.`,
      `Based on your query "${userMessage}", I recommend the following...`,
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
