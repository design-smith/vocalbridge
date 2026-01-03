/**
 * Session Service
 * Business logic for session management with tenant scoping
 */

import { Session } from '../generated/prisma';
import * as SessionRepo from '../repositories/SessionRepo';
import * as AgentRepo from '../repositories/AgentRepo';
import { generateSessionId } from '../utils/ids';
import { sessionNotFoundError, agentNotFoundError } from '../utils/errors';

export interface CreateSessionInput {
  agentId: string;
  customerId: string;
  metadata?: Record<string, unknown>;
}

/**
 * Create a new session for a tenant
 */
export async function createSession(
  tenantId: string,
  input: CreateSessionInput,
  requestId?: string
): Promise<Session> {
  // Verify agent exists and belongs to tenant
  const agent = await AgentRepo.findById(tenantId, input.agentId);
  if (!agent) {
    throw agentNotFoundError(input.agentId, requestId);
  }

  // Generate session ID
  const sessionId = generateSessionId();

  // Create session
  const session = await SessionRepo.create({
    id: sessionId,
    tenantId,
    agentId: input.agentId,
    customerId: input.customerId,
    metadataJson: JSON.stringify(input.metadata || {}),
  });

  return session;
}

/**
 * Get a session by ID (tenant-scoped)
 */
export async function getSession(
  tenantId: string,
  sessionId: string,
  requestId?: string
): Promise<Session> {
  const session = await SessionRepo.findById(tenantId, sessionId);

  if (!session) {
    throw sessionNotFoundError(sessionId, requestId);
  }

  return session;
}

/**
 * List sessions for a tenant with optional filters
 */
export async function listSessions(
  tenantId: string,
  filters?: {
    agentId?: string;
    customerId?: string;
    status?: string;
  }
): Promise<Session[]> {
  return SessionRepo.findAll(tenantId, filters);
}

/**
 * Close a session (update status to 'closed')
 */
export async function closeSession(
  tenantId: string,
  sessionId: string,
  requestId?: string
): Promise<Session> {
  const session = await SessionRepo.closeSession(tenantId, sessionId);

  if (!session) {
    throw sessionNotFoundError(sessionId, requestId);
  }

  return session;
}
