import { prisma } from '../db/prisma';
import { Agent } from '../generated/prisma';

export interface CreateAgentData {
  id: string;
  tenantId: string;
  name: string;
  primaryProvider: string;
  fallbackProvider: string | null;
  systemPrompt: string;
  enabledToolsJson: string;
}

export interface UpdateAgentData {
  name?: string;
  primaryProvider?: string;
  fallbackProvider?: string | null;
  systemPrompt?: string;
  enabledToolsJson?: string;
}

/**
 * Create a new agent
 * Agent is automatically scoped to the tenant
 *
 * @param data - Agent creation data
 * @returns Created agent
 */
export async function create(data: CreateAgentData): Promise<Agent> {
  return prisma.agent.create({
    data,
  });
}

/**
 * Find agent by ID with tenant scoping
 * Returns null if agent doesn't exist or doesn't belong to tenant
 *
 * @param tenantId - The tenant ID
 * @param agentId - The agent ID
 * @returns Agent if found and belongs to tenant, null otherwise
 */
export async function findById(
  tenantId: string,
  agentId: string
): Promise<Agent | null> {
  return prisma.agent.findFirst({
    where: {
      id: agentId,
      tenantId,
    },
  });
}

/**
 * Find all agents for a tenant
 *
 * @param tenantId - The tenant ID
 * @returns Array of agents
 */
export async function findAll(tenantId: string): Promise<Agent[]> {
  return prisma.agent.findMany({
    where: { tenantId },
    orderBy: { createdAt: 'desc' },
  });
}

/**
 * Update an agent with tenant scoping
 * Only updates if agent belongs to tenant
 *
 * @param tenantId - The tenant ID
 * @param agentId - The agent ID
 * @param data - Update data
 * @returns Updated agent or null if not found/not owned by tenant
 */
export async function update(
  tenantId: string,
  agentId: string,
  data: UpdateAgentData
): Promise<Agent | null> {
  // First check if agent exists and belongs to tenant
  const existing = await findById(tenantId, agentId);
  if (!existing) {
    return null;
  }

  return prisma.agent.update({
    where: { id: agentId },
    data,
  });
}

/**
 * Delete an agent with tenant scoping
 *
 * @param tenantId - The tenant ID
 * @param agentId - The agent ID
 * @returns true if deleted, false if not found/not owned by tenant
 */
export async function deleteAgent(
  tenantId: string,
  agentId: string
): Promise<boolean> {
  const existing = await findById(tenantId, agentId);
  if (!existing) {
    return false;
  }

  await prisma.agent.delete({
    where: { id: agentId },
  });

  return true;
}
