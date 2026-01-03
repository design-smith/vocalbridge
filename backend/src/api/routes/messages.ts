/**
 * Messages Routes
 * Send messages in a session (idempotent)
 */

import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import * as ConversationService from '../../services/ConversationService';
import { validationError } from '../../utils/errors';

// Zod schemas
const sendMessageSchema = z.object({
  role: z.literal('user'),
  content: z.string().min(1),
  clientMessageId: z.string().optional(),
});

const sessionIdSchema = z.object({
  sessionId: z.string(),
});

export async function messageRoutes(fastify: FastifyInstance): Promise<void> {
  /**
   * POST /v1/sessions/:sessionId/messages
   * Send a message in a session (IDEMPOTENT)
   * Requires Idempotency-Key header
   */
  fastify.post<{ Params: { sessionId: string } }>(
    '/v1/sessions/:sessionId/messages',
    async (request, reply) => {
      // Validate params
      const paramsResult = sessionIdSchema.safeParse(request.params);
      if (!paramsResult.success) {
        throw validationError(
          'Invalid session ID',
          { errors: paramsResult.error.errors },
          request.requestId
        );
      }

      // Validate body
      const bodyResult = sendMessageSchema.safeParse(request.body);
      if (!bodyResult.success) {
        throw validationError(
          'Invalid request body',
          { errors: bodyResult.error.errors },
          request.requestId
        );
      }

      const { sessionId } = paramsResult.data;
      const { content } = bodyResult.data;

      // Extract idempotency key from header
      const idempotencyKey = request.headers['idempotency-key'] as
        | string
        | undefined;

      // Send message (service handles idempotency validation and logic)
      const result = await ConversationService.sendMessage(
        request.tenant.id,
        sessionId,
        idempotencyKey,
        content,
        request.requestId
      );

      // Return 200 for replayed responses, 201 for new responses
      if (result.metadata.idempotency.replayed) {
        reply.code(200);
      } else {
        reply.code(201);
      }

      return result;
    }
  );
}
