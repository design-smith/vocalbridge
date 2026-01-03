/**
 * Agent Service
 * Business logic for agent management with tenant scoping
 */

import { Agent } from '../generated/prisma';
import * as AgentRepo from '../repositories/AgentRepo';
import { generateAgentId } from '../utils/ids';
import { agentNotFoundError, validationError } from '../utils/errors';

export interface CreateAgentInput {
  name: string;
  primaryProvider: 'vendorA' | 'vendorB';
  fallbackProvider?: 'vendorA' | 'vendorB' | null;
  systemPrompt: string;
  enabledTools?: string[];
}

export interface UpdateAgentInput {
  name?: string;
  primaryProvider?: 'vendorA' | 'vendorB';
  fallbackProvider?: 'vendorA' | 'vendorB' | null;
  systemPrompt?: string;
  enabledTools?: string[];
}

/**
 * Create a new agent for a tenant
 */
export async function createAgent(
  tenantId: string,
  input: CreateAgentInput,
  requestId?: string
): Promise<Agent> {
  // Validate input
  validateAgentInput(input, requestId);

  // Generate agent ID
  const agentId = generateAgentId();

  // Create agent
  const agent = await AgentRepo.create({
    id: agentId,
    tenantId,
    name: input.name,
    primaryProvider: input.primaryProvider,
    fallbackProvider: input.fallbackProvider ?? null,
    systemPrompt: input.systemPrompt,
    enabledToolsJson: JSON.stringify(input.enabledTools || []),
  });

  return agent;
}

/**
 * Get an agent by ID (tenant-scoped)
 */
export async function getAgent(
  tenantId: string,
  agentId: string,
  requestId?: string
): Promise<Agent> {
  const agent = await AgentRepo.findById(tenantId, agentId);

  if (!agent) {
    throw agentNotFoundError(agentId, requestId);
  }

  return agent;
}

/**
 * List all agents for a tenant
 */
export async function listAgents(tenantId: string): Promise<Agent[]> {
  return AgentRepo.findAll(tenantId);
}

/**
 * Update an agent (tenant-scoped)
 */
export async function updateAgent(
  tenantId: string,
  agentId: string,
  input: UpdateAgentInput,
  requestId?: string
): Promise<Agent> {
  // Validate input if provided
  if (Object.keys(input).length > 0) {
    validateAgentInput(input as CreateAgentInput, requestId);
  }

  // Prepare update data
  const updateData: AgentRepo.UpdateAgentData = {
    ...(input.name && { name: input.name }),
    ...(input.primaryProvider && { primaryProvider: input.primaryProvider }),
    ...(input.fallbackProvider !== undefined && {
      fallbackProvider: input.fallbackProvider,
    }),
    ...(input.systemPrompt && { systemPrompt: input.systemPrompt }),
    ...(input.enabledTools !== undefined && {
      enabledToolsJson: JSON.stringify(input.enabledTools),
    }),
  };

  const agent = await AgentRepo.update(tenantId, agentId, updateData);

  if (!agent) {
    throw agentNotFoundError(agentId, requestId);
  }

  return agent;
}

/**
 * Delete an agent (tenant-scoped)
 */
export async function deleteAgent(
  tenantId: string,
  agentId: string,
  requestId?: string
): Promise<void> {
  const deleted = await AgentRepo.deleteAgent(tenantId, agentId);

  if (!deleted) {
    throw agentNotFoundError(agentId, requestId);
  }
}

/**
 * Validate agent input
 */
function validateAgentInput(
  input: Partial<CreateAgentInput>,
  requestId?: string
): void {
  if (input.name !== undefined && input.name.trim().length === 0) {
    throw validationError('Agent name cannot be empty', { field: 'name' }, requestId);
  }

  if (
    input.primaryProvider &&
    !['vendorA', 'vendorB'].includes(input.primaryProvider)
  ) {
    throw validationError(
      'Primary provider must be "vendorA" or "vendorB"',
      { field: 'primaryProvider', value: input.primaryProvider },
      requestId
    );
  }

  if (
    input.fallbackProvider &&
    !['vendorA', 'vendorB'].includes(input.fallbackProvider)
  ) {
    throw validationError(
      'Fallback provider must be "vendorA" or "vendorB"',
      { field: 'fallbackProvider', value: input.fallbackProvider },
      requestId
    );
  }

  if (
    input.primaryProvider &&
    input.fallbackProvider &&
    input.primaryProvider === input.fallbackProvider
  ) {
    throw validationError(
      'Fallback provider must be different from primary provider',
      {
        field: 'fallbackProvider',
        primaryProvider: input.primaryProvider,
        fallbackProvider: input.fallbackProvider,
      },
      requestId
    );
  }

  if (input.systemPrompt !== undefined && input.systemPrompt.trim().length === 0) {
    throw validationError(
      'System prompt cannot be empty',
      { field: 'systemPrompt' },
      requestId
    );
  }
}
