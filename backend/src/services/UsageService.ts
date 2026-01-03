/**
 * Usage Service
 * Business logic for usage analytics and rollups
 */

import * as UsageEventRepo from '../repositories/UsageEventRepo';
import { UsageEvent } from '../generated/prisma';

export interface UsageRollupResponse {
  range: {
    from: string;
    to: string;
  };
  totals: {
    sessions: number;
    messages: number;
    tokensIn: number;
    tokensOut: number;
    tokensTotal: number;
    costUsd: number;
  };
  byProvider: Array<{
    provider: string;
    sessions: number;
    tokensIn: number;
    tokensOut: number;
    tokensTotal: number;
    costUsd: number;
  }>;
  topAgentsByCost: Array<{
    agentId: string;
    agentName: string;
    sessions: number;
    tokensTotal: number;
    costUsd: number;
  }>;
}

/**
 * Get usage rollup for a tenant within a date range
 */
export async function getUsageRollup(
  tenantId: string,
  from: Date,
  to: Date
): Promise<UsageRollupResponse> {
  const rollup = await UsageEventRepo.getRollup(tenantId, from, to);

  return {
    range: {
      from: from.toISOString().split('T')[0],
      to: to.toISOString().split('T')[0],
    },
    totals: rollup.totals,
    byProvider: rollup.byProvider,
    topAgentsByCost: rollup.topAgentsByCost,
  };
}

/**
 * List usage events for a tenant within a date range
 */
export async function listUsageEvents(
  tenantId: string,
  from: Date,
  to: Date,
  limit?: number
): Promise<UsageEvent[]> {
  return UsageEventRepo.listEvents(tenantId, from, to, limit);
}

/**
 * Get monthly usage data for the last 12 months
 * Not affected by date filters - always returns last 12 months
 */
export async function getMonthlyUsage(
  tenantId: string
): Promise<UsageEventRepo.MonthlyUsage[]> {
  return UsageEventRepo.getMonthlyUsage(tenantId);
}
