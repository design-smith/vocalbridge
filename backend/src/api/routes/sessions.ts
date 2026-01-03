/**
 * Sessions Routes
 * Create sessions and get transcripts
 */

import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import * as SessionService from '../../services/SessionService';
import * as MessageRepo from '../../repositories/MessageRepo';
import * as ProviderCallEventRepo from '../../repositories/ProviderCallEventRepo';
import { validationError } from '../../utils/errors';

// Zod schemas
const createSessionSchema = z.object({
  agentId: z.string(),
  customerId: z.string(),
  metadata: z.record(z.unknown()).optional(),
});

const sessionIdSchema = z.object({
  sessionId: z.string(),
});

export async function sessionRoutes(fastify: FastifyInstance): Promise<void> {
  /**
   * POST /v1/sessions
   * Create a new conversation session
   */
  fastify.post('/v1/sessions', async (request, reply) => {
    // Validate request body
    const parseResult = createSessionSchema.safeParse(request.body);
    if (!parseResult.success) {
      throw validationError(
        'Invalid request body',
        { errors: parseResult.error.errors },
        request.requestId
      );
    }

    const data = parseResult.data;

    const session = await SessionService.createSession(
      request.tenant.id,
      data,
      request.requestId
    );

    reply.code(201);
    return {
      session: {
        id: session.id,
        agentId: session.agentId,
        customerId: session.customerId,
        status: session.status,
        createdAt: session.createdAt.toISOString(),
        lastActivityAt: session.lastActivityAt.toISOString(),
        metadata: JSON.parse(session.metadataJson),
      },
    };
  });

  /**
   * GET /v1/sessions/:sessionId/transcript
   * Get the full transcript and events for a session
   */
  fastify.get<{ Params: { sessionId: string } }>(
    '/v1/sessions/:sessionId/transcript',
    async (request, reply) => {
      // Validate params
      const parseResult = sessionIdSchema.safeParse(request.params);
      if (!parseResult.success) {
        throw validationError(
          'Invalid session ID',
          { errors: parseResult.error.errors },
          request.requestId
        );
      }

      const { sessionId } = parseResult.data;

      // Get session (validates it exists and belongs to tenant)
      const session = await SessionService.getSession(
        request.tenant.id,
        sessionId,
        request.requestId
      );

      // Get messages
      const messages = await MessageRepo.listBySession(
        request.tenant.id,
        sessionId
      );

      // Get provider call events
      const events = await ProviderCallEventRepo.listBySession(
        request.tenant.id,
        sessionId
      );

      return {
        session: {
          id: session.id,
          agentId: session.agentId,
          customerId: session.customerId,
          status: session.status,
          createdAt: session.createdAt.toISOString(),
          lastActivityAt: session.lastActivityAt.toISOString(),
          metadata: JSON.parse(session.metadataJson),
        },
        messages: messages.map((msg) => ({
          id: msg.id,
          role: msg.role,
          content: msg.content,
          createdAt: msg.createdAt.toISOString(),
        })),
        events: events.map((event) => ({
          id: event.id,
          type: 'provider_call',
          provider: event.provider,
          status: event.status,
          httpStatus: event.httpStatus,
          latencyMs: event.latencyMs,
          retries: event.retries,
          errorCode: event.errorCode,
          errorMessage: event.errorMessage,
          createdAt: event.createdAt.toISOString(),
        })),
      };
    }
  );
}
