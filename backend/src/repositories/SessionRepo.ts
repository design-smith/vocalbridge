import { prisma } from '../db/prisma';
import { Session } from '../generated/prisma';

export interface CreateSessionData {
  id: string;
  tenantId: string;
  agentId: string;
  customerId: string;
  metadataJson: string;
}

/**
 * Create a new session
 *
 * @param data - Session creation data
 * @returns Created session
 */
export async function create(data: CreateSessionData): Promise<Session> {
  return prisma.session.create({
    data: {
      ...data,
      status: 'active',
      lastActivityAt: new Date(),
    },
  });
}

/**
 * Find session by ID with tenant scoping
 * Returns null if session doesn't exist or doesn't belong to tenant
 *
 * @param tenantId - The tenant ID
 * @param sessionId - The session ID
 * @returns Session if found and belongs to tenant, null otherwise
 */
export async function findById(
  tenantId: string,
  sessionId: string
): Promise<Session | null> {
  return prisma.session.findFirst({
    where: {
      id: sessionId,
      tenantId,
    },
  });
}

/**
 * Update session's lastActivityAt timestamp
 *
 * @param sessionId - The session ID
 * @returns Updated session
 */
export async function updateLastActivity(sessionId: string): Promise<Session> {
  return prisma.session.update({
    where: { id: sessionId },
    data: { lastActivityAt: new Date() },
  });
}

/**
 * Find all sessions for a tenant
 *
 * @param tenantId - The tenant ID
 * @param filters - Optional filters (agentId, customerId, status)
 * @returns Array of sessions
 */
export async function findAll(
  tenantId: string,
  filters?: {
    agentId?: string;
    customerId?: string;
    status?: string;
  }
): Promise<Session[]> {
  return prisma.session.findMany({
    where: {
      tenantId,
      ...(filters?.agentId && { agentId: filters.agentId }),
      ...(filters?.customerId && { customerId: filters.customerId }),
      ...(filters?.status && { status: filters.status }),
    },
    orderBy: { lastActivityAt: 'desc' },
  });
}

/**
 * Close a session (update status to 'closed')
 *
 * @param tenantId - The tenant ID
 * @param sessionId - The session ID
 * @returns Updated session or null if not found
 */
export async function closeSession(
  tenantId: string,
  sessionId: string
): Promise<Session | null> {
  const existing = await findById(tenantId, sessionId);
  if (!existing) {
    return null;
  }

  return prisma.session.update({
    where: { id: sessionId },
    data: { status: 'closed', lastActivityAt: new Date() },
  });
}
