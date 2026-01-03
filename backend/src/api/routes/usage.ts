/**
 * Usage Routes
 * Get usage rollups and events
 */

import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import * as UsageService from '../../services/UsageService';
import { validationError } from '../../utils/errors';

// Zod schemas
const rollupQuerySchema = z.object({
  from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});

const eventsQuerySchema = z.object({
  from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  limit: z.coerce.number().int().positive().max(1000).optional().default(200),
});

export async function usageRoutes(fastify: FastifyInstance): Promise<void> {
  /**
   * GET /v1/usage/rollup
   * Get usage rollup for a date range
   */
  fastify.get('/v1/usage/rollup', async (request, reply) => {
    // Validate query params
    const parseResult = rollupQuerySchema.safeParse(request.query);
    if (!parseResult.success) {
      throw validationError(
        'Invalid query parameters',
        { errors: parseResult.error.errors },
        request.requestId
      );
    }

    const { from, to } = parseResult.data;

    // Parse dates
    const fromDate = new Date(from);
    const toDate = new Date(to);
    toDate.setHours(23, 59, 59, 999); // Include the entire end date

    // Validate date range
    if (fromDate > toDate) {
      throw validationError(
        'Invalid date range: "from" must be before or equal to "to"',
        { from, to },
        request.requestId
      );
    }

    const rollup = await UsageService.getUsageRollup(
      request.tenant.id,
      fromDate,
      toDate
    );

    return rollup;
  });

  /**
   * GET /v1/usage/events
   * Get usage events for a date range
   */
  fastify.get('/v1/usage/events', async (request, reply) => {
    // Validate query params
    const parseResult = eventsQuerySchema.safeParse(request.query);
    if (!parseResult.success) {
      throw validationError(
        'Invalid query parameters',
        { errors: parseResult.error.errors },
        request.requestId
      );
    }

    const { from, to, limit } = parseResult.data;

    // Parse dates
    const fromDate = new Date(from);
    const toDate = new Date(to);
    toDate.setHours(23, 59, 59, 999);

    // Validate date range
    if (fromDate > toDate) {
      throw validationError(
        'Invalid date range: "from" must be before or equal to "to"',
        { from, to },
        request.requestId
      );
    }

    const events = await UsageService.listUsageEvents(
      request.tenant.id,
      fromDate,
      toDate,
      limit
    );

    return {
      events: events.map((event) => ({
        id: event.id,
        sessionId: event.sessionId,
        agentId: event.agentId,
        provider: event.provider,
        tokensIn: event.tokensIn,
        tokensOut: event.tokensOut,
        costUsd: event.costUsd,
        createdAt: event.createdAt.toISOString(),
        requestId: event.requestId,
      })),
      count: events.length,
      limit,
    };
  });

  /**
   * GET /v1/usage/monthly
   * Get monthly usage data for the last 12 months
   * Not affected by date filters
   */
  fastify.get('/v1/usage/monthly', async (request, reply) => {
    const monthlyData = await UsageService.getMonthlyUsage(request.tenant.id);

    return {
      monthly: monthlyData,
    };
  });
}
