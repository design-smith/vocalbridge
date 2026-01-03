/**
 * Pricing configuration for AI providers
 * Prices are in USD per 1,000 tokens
 */

export type ProviderName = 'vendorA' | 'vendorB';

export interface ProviderPricing {
  usdPer1kTokens: number;
}

/**
 * Pricing table - hardcoded as per requirements
 */
export const PRICING_TABLE: Record<ProviderName, ProviderPricing> = {
  vendorA: {
    usdPer1kTokens: 0.002,
  },
  vendorB: {
    usdPer1kTokens: 0.003,
  },
};

/**
 * Calculate cost in USD for a provider call
 *
 * @param provider - The provider name ("vendorA" | "vendorB")
 * @param tokensIn - Number of input tokens
 * @param tokensOut - Number of output tokens
 * @returns Cost in USD (rounded to 6 decimal places for precision)
 */
export function calculateCost(
  provider: ProviderName,
  tokensIn: number,
  tokensOut: number
): number {
  const pricing = PRICING_TABLE[provider];

  if (!pricing) {
    throw new Error(`Unknown provider: ${provider}`);
  }

  const totalTokens = tokensIn + tokensOut;
  const costUsd = (totalTokens / 1000) * pricing.usdPer1kTokens;

  // Round to 6 decimal places to avoid floating point precision issues
  return Math.round(costUsd * 1000000) / 1000000;
}

/**
 * Get pricing information for a provider
 *
 * @param provider - The provider name
 * @returns Pricing information
 */
export function getPricing(provider: ProviderName): ProviderPricing {
  const pricing = PRICING_TABLE[provider];

  if (!pricing) {
    throw new Error(`Unknown provider: ${provider}`);
  }

  return pricing;
}

/**
 * Get all pricing information (for /v1/me endpoint)
 *
 * @returns All provider pricing
 */
export function getAllPricing(): Record<ProviderName, ProviderPricing> {
  return PRICING_TABLE;
}
