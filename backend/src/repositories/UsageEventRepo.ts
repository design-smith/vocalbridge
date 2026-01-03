import { prisma } from '../db/prisma';
import { UsageEvent } from '../generated/prisma';

export interface CreateUsageEventData {
  id: string;
  tenantId: string;
  sessionId: string;
  agentId: string;
  provider: string;
  tokensIn: number;
  tokensOut: number;
  costUsd: number;
  requestId: string;
}

export interface UsageRollup {
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
 * Create a usage event
 * Should be created exactly once per assistant message
 *
 * @param data - Usage event data
 * @returns Created event
 */
export async function create(data: CreateUsageEventData): Promise<UsageEvent> {
  return prisma.usageEvent.create({
    data,
  });
}

/**
 * List usage events for a tenant within a date range
 *
 * @param tenantId - The tenant ID
 * @param from - Start date
 * @param to - End date
 * @param limit - Optional limit
 * @returns Array of usage events
 */
export async function listEvents(
  tenantId: string,
  from: Date,
  to: Date,
  limit?: number
): Promise<UsageEvent[]> {
  return prisma.usageEvent.findMany({
    where: {
      tenantId,
      createdAt: {
        gte: from,
        lte: to,
      },
    },
    orderBy: { createdAt: 'desc' },
    ...(limit && { take: limit }),
  });
}

/**
 * Get usage rollup for a tenant within a date range
 * Aggregates usage by provider and agent
 *
 * @param tenantId - The tenant ID
 * @param from - Start date
 * @param to - End date
 * @returns Rollup data
 */
export async function getRollup(
  tenantId: string,
  from: Date,
  to: Date
): Promise<UsageRollup> {
  // Fetch all usage events in the date range
  const events = await prisma.usageEvent.findMany({
    where: {
      tenantId,
      createdAt: {
        gte: from,
        lte: to,
      },
    },
    include: {
      agent: true,
    },
  });

  // Calculate totals
  const uniqueSessions = new Set(events.map((e) => e.sessionId));
  const totals = {
    sessions: uniqueSessions.size,
    messages: events.length,
    tokensIn: events.reduce((sum, e) => sum + e.tokensIn, 0),
    tokensOut: events.reduce((sum, e) => sum + e.tokensOut, 0),
    tokensTotal: events.reduce((sum, e) => sum + e.tokensIn + e.tokensOut, 0),
    costUsd: events.reduce((sum, e) => sum + e.costUsd, 0),
  };

  // Group by provider
  const providerMap = new Map<
    string,
    {
      sessions: Set<string>;
      tokensIn: number;
      tokensOut: number;
      costUsd: number;
    }
  >();

  events.forEach((event) => {
    if (!providerMap.has(event.provider)) {
      providerMap.set(event.provider, {
        sessions: new Set(),
        tokensIn: 0,
        tokensOut: 0,
        costUsd: 0,
      });
    }

    const group = providerMap.get(event.provider)!;
    group.sessions.add(event.sessionId);
    group.tokensIn += event.tokensIn;
    group.tokensOut += event.tokensOut;
    group.costUsd += event.costUsd;
  });

  const byProvider = Array.from(providerMap.entries()).map(
    ([provider, data]) => ({
      provider,
      sessions: data.sessions.size,
      tokensIn: data.tokensIn,
      tokensOut: data.tokensOut,
      tokensTotal: data.tokensIn + data.tokensOut,
      costUsd: data.costUsd,
    })
  );

  // Group by agent
  const agentMap = new Map<
    string,
    {
      agentName: string;
      sessions: Set<string>;
      tokensTotal: number;
      costUsd: number;
    }
  >();

  events.forEach((event) => {
    if (!agentMap.has(event.agentId)) {
      agentMap.set(event.agentId, {
        agentName: event.agent.name,
        sessions: new Set(),
        tokensTotal: 0,
        costUsd: 0,
      });
    }

    const group = agentMap.get(event.agentId)!;
    group.sessions.add(event.sessionId);
    group.tokensTotal += event.tokensIn + event.tokensOut;
    group.costUsd += event.costUsd;
  });

  const topAgentsByCost = Array.from(agentMap.entries())
    .map(([agentId, data]) => ({
      agentId,
      agentName: data.agentName,
      sessions: data.sessions.size,
      tokensTotal: data.tokensTotal,
      costUsd: data.costUsd,
    }))
    .sort((a, b) => b.costUsd - a.costUsd)
    .slice(0, 10); // Top 10 agents

  return {
    totals,
    byProvider,
    topAgentsByCost,
  };
}

export interface MonthlyUsage {
  month: string; // YYYY-MM format
  vendorA: number; // cost in USD
  vendorB: number; // cost in USD
}

/**
 * Get monthly usage data for the last 12 months
 * Not affected by date filters - always returns last 12 months
 *
 * @param tenantId - The tenant ID
 * @returns Array of monthly usage data
 */
export async function getMonthlyUsage(tenantId: string): Promise<MonthlyUsage[]> {
  // Calculate date range for last 12 months
  const now = new Date();
  const twelveMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 11, 1);

  // Fetch all usage events in the last 12 months
  const events = await prisma.usageEvent.findMany({
    where: {
      tenantId,
      createdAt: {
        gte: twelveMonthsAgo,
      },
    },
  });

  // Group by month and provider
  const monthlyMap = new Map<string, { vendorA: number; vendorB: number }>();

  // Initialize all 12 months with zeros
  for (let i = 11; i >= 0; i--) {
    const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
    monthlyMap.set(monthKey, { vendorA: 0, vendorB: 0 });
  }

  // Aggregate costs by month and provider
  events.forEach((event) => {
    const eventDate = new Date(event.createdAt);
    const monthKey = `${eventDate.getFullYear()}-${String(eventDate.getMonth() + 1).padStart(2, '0')}`;

    const monthData = monthlyMap.get(monthKey);
    if (monthData) {
      if (event.provider === 'vendorA') {
        monthData.vendorA += event.costUsd;
      } else if (event.provider === 'vendorB') {
        monthData.vendorB += event.costUsd;
      }
    }
  });

  // Convert to array and sort by month
  return Array.from(monthlyMap.entries())
    .map(([month, data]) => ({
      month,
      vendorA: data.vendorA,
      vendorB: data.vendorB,
    }))
    .sort((a, b) => a.month.localeCompare(b.month));
}
