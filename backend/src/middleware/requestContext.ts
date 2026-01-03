/**
 * Request context middleware
 * Generates requestId and correlationId for request tracking
 */

import { FastifyRequest, FastifyReply } from 'fastify';
import { generateRequestId } from '../utils/ids';

/**
 * Extend Fastify request type to include requestId
 */
declare module 'fastify' {
  interface FastifyRequest {
    requestId: string;
    correlationId?: string;
  }
}

/**
 * Request context middleware
 * Generates a unique requestId for each request
 * Also extracts correlationId from headers if provided
 */
export async function requestContext(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  // Generate unique request ID
  const requestId = generateRequestId();
  request.requestId = requestId;

  // Extract correlation ID from header (if provided by client)
  const correlationId = request.headers['x-correlation-id'] as string | undefined;
  if (correlationId) {
    request.correlationId = correlationId;
  }

  // Add requestId to response headers for client debugging
  reply.header('x-request-id', requestId);

  if (correlationId) {
    reply.header('x-correlation-id', correlationId);
  }
}
