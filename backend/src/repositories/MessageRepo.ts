import { prisma } from '../db/prisma';
import { Message } from '../generated/prisma';

export interface CreateMessageData {
  id: string;
  tenantId: string;
  sessionId: string;
  role: 'user' | 'assistant';
  content: string;
}

/**
 * Create a new message
 *
 * @param data - Message creation data
 * @returns Created message
 */
export async function create(data: CreateMessageData): Promise<Message> {
  return prisma.message.create({
    data,
  });
}

/**
 * List all messages for a session with tenant scoping
 *
 * @param tenantId - The tenant ID
 * @param sessionId - The session ID
 * @param limit - Optional limit on number of messages
 * @returns Array of messages ordered by creation time
 */
export async function listBySession(
  tenantId: string,
  sessionId: string,
  limit?: number
): Promise<Message[]> {
  return prisma.message.findMany({
    where: {
      tenantId,
      sessionId,
    },
    orderBy: { createdAt: 'asc' },
    ...(limit && { take: limit }),
  });
}

/**
 * Get the most recent message in a session
 *
 * @param tenantId - The tenant ID
 * @param sessionId - The session ID
 * @returns Most recent message or null if no messages
 */
export async function getLastMessage(
  tenantId: string,
  sessionId: string
): Promise<Message | null> {
  return prisma.message.findFirst({
    where: {
      tenantId,
      sessionId,
    },
    orderBy: { createdAt: 'desc' },
  });
}

/**
 * Count messages in a session
 *
 * @param tenantId - The tenant ID
 * @param sessionId - The session ID
 * @returns Number of messages
 */
export async function countBySession(
  tenantId: string,
  sessionId: string
): Promise<number> {
  return prisma.message.count({
    where: {
      tenantId,
      sessionId,
    },
  });
}
