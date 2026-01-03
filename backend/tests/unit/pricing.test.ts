import { describe, it, expect } from 'vitest';
import {
  calculateCost,
  getPricing,
  getAllPricing,
  PRICING_TABLE,
  type ProviderName,
} from '../../src/billing/pricing';

describe('Pricing', () => {
  describe('PRICING_TABLE', () => {
    it('should have correct pricing for vendorA', () => {
      expect(PRICING_TABLE.vendorA.usdPer1kTokens).toBe(0.002);
    });

    it('should have correct pricing for vendorB', () => {
      expect(PRICING_TABLE.vendorB.usdPer1kTokens).toBe(0.003);
    });
  });

  describe('calculateCost', () => {
    describe('vendorA', () => {
      it('should calculate cost for 1000 tokens', () => {
        const cost = calculateCost('vendorA', 500, 500);
        expect(cost).toBe(0.002);
      });

      it('should calculate cost for 2000 tokens', () => {
        const cost = calculateCost('vendorA', 1000, 1000);
        expect(cost).toBe(0.004);
      });

      it('should calculate cost for fractional amounts', () => {
        const cost = calculateCost('vendorA', 100, 50);
        expect(cost).toBe(0.0003); // 150 / 1000 * 0.002 = 0.0003
      });

      it('should handle zero tokens', () => {
        const cost = calculateCost('vendorA', 0, 0);
        expect(cost).toBe(0);
      });

      it('should handle input-only tokens', () => {
        const cost = calculateCost('vendorA', 1000, 0);
        expect(cost).toBe(0.002);
      });

      it('should handle output-only tokens', () => {
        const cost = calculateCost('vendorA', 0, 1000);
        expect(cost).toBe(0.002);
      });

      it('should calculate realistic example', () => {
        // 100 tokens in, 200 tokens out
        const cost = calculateCost('vendorA', 100, 200);
        // 300 / 1000 * 0.002 = 0.0006
        expect(cost).toBe(0.0006);
      });
    });

    describe('vendorB', () => {
      it('should calculate cost for 1000 tokens', () => {
        const cost = calculateCost('vendorB', 500, 500);
        expect(cost).toBe(0.003);
      });

      it('should calculate cost for 2000 tokens', () => {
        const cost = calculateCost('vendorB', 1000, 1000);
        expect(cost).toBe(0.006);
      });

      it('should calculate cost for fractional amounts', () => {
        const cost = calculateCost('vendorB', 100, 50);
        expect(cost).toBe(0.00045); // 150 / 1000 * 0.003 = 0.00045
      });

      it('should calculate realistic example', () => {
        // 100 tokens in, 200 tokens out
        const cost = calculateCost('vendorB', 100, 200);
        // 300 / 1000 * 0.003 = 0.0009
        expect(cost).toBe(0.0009);
      });
    });

    describe('edge cases', () => {
      it('should round to 6 decimal places', () => {
        // Create a scenario that would have more than 6 decimals
        const cost = calculateCost('vendorA', 1, 1);
        // 2 / 1000 * 0.002 = 0.000004
        expect(cost).toBe(0.000004);
        expect(cost.toString().split('.')[1]?.length || 0).toBeLessThanOrEqual(6);
      });

      it('should handle large token counts', () => {
        const cost = calculateCost('vendorA', 500000, 500000);
        // 1,000,000 / 1000 * 0.002 = 2.0
        expect(cost).toBe(2.0);
      });

      it('should throw error for unknown provider', () => {
        expect(() => {
          calculateCost('vendorC' as ProviderName, 100, 100);
        }).toThrow('Unknown provider: vendorC');
      });
    });

    describe('cost comparison', () => {
      it('vendorB should be more expensive than vendorA for same tokens', () => {
        const costA = calculateCost('vendorA', 1000, 1000);
        const costB = calculateCost('vendorB', 1000, 1000);
        expect(costB).toBeGreaterThan(costA);
      });

      it('should maintain correct ratio between providers', () => {
        const costA = calculateCost('vendorA', 1000, 1000);
        const costB = calculateCost('vendorB', 1000, 1000);
        // vendorB is 1.5x more expensive (0.003 / 0.002)
        expect(costB / costA).toBe(1.5);
      });
    });
  });

  describe('getPricing', () => {
    it('should return pricing for vendorA', () => {
      const pricing = getPricing('vendorA');
      expect(pricing).toEqual({ usdPer1kTokens: 0.002 });
    });

    it('should return pricing for vendorB', () => {
      const pricing = getPricing('vendorB');
      expect(pricing).toEqual({ usdPer1kTokens: 0.003 });
    });

    it('should throw error for unknown provider', () => {
      expect(() => {
        getPricing('vendorC' as ProviderName);
      }).toThrow('Unknown provider: vendorC');
    });
  });

  describe('getAllPricing', () => {
    it('should return all provider pricing', () => {
      const allPricing = getAllPricing();
      expect(allPricing).toEqual({
        vendorA: { usdPer1kTokens: 0.002 },
        vendorB: { usdPer1kTokens: 0.003 },
      });
    });

    it('should return object with correct keys', () => {
      const allPricing = getAllPricing();
      expect(Object.keys(allPricing)).toEqual(['vendorA', 'vendorB']);
    });
  });
});
