import { prisma } from '../db/prisma';
import { ProviderCallEvent } from '../generated/prisma';

export interface CreateProviderCallEventData {
  id: string;
  tenantId: string;
  sessionId: string;
  agentId: string;
  provider: string;
  status: 'success' | 'failed';
  httpStatus?: number;
  latencyMs?: number;
  retries: number;
  errorCode?: string;
  errorMessage?: string;
  requestId: string;
}

/**
 * Create a provider call event
 * Records each attempt to call a provider (including retries)
 *
 * @param data - Event data
 * @returns Created event
 */
export async function create(
  data: CreateProviderCallEventData
): Promise<ProviderCallEvent> {
  return prisma.providerCallEvent.create({
    data: {
      id: data.id,
      tenantId: data.tenantId,
      sessionId: data.sessionId,
      agentId: data.agentId,
      provider: data.provider,
      status: data.status,
      httpStatus: data.httpStatus ?? null,
      latencyMs: data.latencyMs ?? null,
      retries: data.retries,
      errorCode: data.errorCode ?? null,
      errorMessage: data.errorMessage ?? null,
      requestId: data.requestId,
    },
  });
}

/**
 * List all provider call events for a session with tenant scoping
 *
 * @param tenantId - The tenant ID
 * @param sessionId - The session ID
 * @returns Array of events ordered by creation time
 */
export async function listBySession(
  tenantId: string,
  sessionId: string
): Promise<ProviderCallEvent[]> {
  return prisma.providerCallEvent.findMany({
    where: {
      tenantId,
      sessionId,
    },
    orderBy: { createdAt: 'asc' },
  });
}

/**
 * List provider call events by request ID
 * Useful for debugging a specific request flow
 *
 * @param tenantId - The tenant ID
 * @param requestId - The request ID
 * @returns Array of events for this request
 */
export async function listByRequestId(
  tenantId: string,
  requestId: string
): Promise<ProviderCallEvent[]> {
  return prisma.providerCallEvent.findMany({
    where: {
      tenantId,
      requestId,
    },
    orderBy: { createdAt: 'asc' },
  });
}

/**
 * Get provider call statistics for a tenant
 *
 * @param tenantId - The tenant ID
 * @param from - Start date
 * @param to - End date
 * @returns Statistics by provider
 */
export async function getStatistics(
  tenantId: string,
  from: Date,
  to: Date
): Promise<
  Array<{
    provider: string;
    totalCalls: number;
    successfulCalls: number;
    failedCalls: number;
    avgLatencyMs: number;
  }>
> {
  // Note: For SQLite, we need to do aggregation in application code
  // In production Postgres, this could be done with raw SQL
  const events = await prisma.providerCallEvent.findMany({
    where: {
      tenantId,
      createdAt: {
        gte: from,
        lte: to,
      },
    },
  });

  const groupedByProvider = events.reduce(
    (acc, event) => {
      if (!acc[event.provider]) {
        acc[event.provider] = {
          provider: event.provider,
          totalCalls: 0,
          successfulCalls: 0,
          failedCalls: 0,
          totalLatency: 0,
          latencyCount: 0,
        };
      }

      const group = acc[event.provider];
      group.totalCalls++;

      if (event.status === 'success') {
        group.successfulCalls++;
      } else {
        group.failedCalls++;
      }

      if (event.latencyMs !== null) {
        group.totalLatency += event.latencyMs;
        group.latencyCount++;
      }

      return acc;
    },
    {} as Record<
      string,
      {
        provider: string;
        totalCalls: number;
        successfulCalls: number;
        failedCalls: number;
        totalLatency: number;
        latencyCount: number;
      }
    >
  );

  return Object.values(groupedByProvider).map((group) => ({
    provider: group.provider,
    totalCalls: group.totalCalls,
    successfulCalls: group.successfulCalls,
    failedCalls: group.failedCalls,
    avgLatencyMs:
      group.latencyCount > 0 ? group.totalLatency / group.latencyCount : 0,
  }));
}
