/**
 * Agents Routes
 * CRUD operations for agents
 */

import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import * as AgentService from '../../services/AgentService';
import { validationError } from '../../utils/errors';

// Zod schemas for validation
const createAgentSchema = z.object({
  name: z.string().min(1).max(200),
  primaryProvider: z.enum(['vendorA', 'vendorB']),
  fallbackProvider: z.enum(['vendorA', 'vendorB']).nullable().optional(),
  systemPrompt: z.string().min(1),
  enabledTools: z.array(z.string()).optional(),
});

const updateAgentSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  primaryProvider: z.enum(['vendorA', 'vendorB']).optional(),
  fallbackProvider: z.enum(['vendorA', 'vendorB']).nullable().optional(),
  systemPrompt: z.string().min(1).optional(),
  enabledTools: z.array(z.string()).optional(),
});

const agentIdSchema = z.object({
  agentId: z.string(),
});

export async function agentRoutes(fastify: FastifyInstance): Promise<void> {
  /**
   * GET /v1/agents
   * List all agents for the authenticated tenant
   */
  fastify.get('/v1/agents', async (request, reply) => {
    const agents = await AgentService.listAgents(request.tenant.id);

    return {
      agents: agents.map((agent) => ({
        id: agent.id,
        name: agent.name,
        primaryProvider: agent.primaryProvider,
        fallbackProvider: agent.fallbackProvider,
        systemPrompt: agent.systemPrompt,
        enabledTools: JSON.parse(agent.enabledToolsJson),
        createdAt: agent.createdAt.toISOString(),
        updatedAt: agent.updatedAt.toISOString(),
      })),
    };
  });

  /**
   * POST /v1/agents
   * Create a new agent
   */
  fastify.post('/v1/agents', async (request, reply) => {
    // Validate request body
    const parseResult = createAgentSchema.safeParse(request.body);
    if (!parseResult.success) {
      throw validationError(
        'Invalid request body',
        { errors: parseResult.error.errors },
        request.requestId
      );
    }

    const data = parseResult.data;

    const agent = await AgentService.createAgent(
      request.tenant.id,
      data,
      request.requestId
    );

    reply.code(201);
    return {
      agent: {
        id: agent.id,
        name: agent.name,
        primaryProvider: agent.primaryProvider,
        fallbackProvider: agent.fallbackProvider,
        systemPrompt: agent.systemPrompt,
        enabledTools: JSON.parse(agent.enabledToolsJson),
        createdAt: agent.createdAt.toISOString(),
        updatedAt: agent.updatedAt.toISOString(),
      },
    };
  });

  /**
   * GET /v1/agents/:agentId
   * Get a specific agent by ID
   */
  fastify.get<{ Params: { agentId: string } }>(
    '/v1/agents/:agentId',
    async (request, reply) => {
      // Validate params
      const parseResult = agentIdSchema.safeParse(request.params);
      if (!parseResult.success) {
        throw validationError(
          'Invalid agent ID',
          { errors: parseResult.error.errors },
          request.requestId
        );
      }

      const { agentId } = parseResult.data;

      const agent = await AgentService.getAgent(
        request.tenant.id,
        agentId,
        request.requestId
      );

      return {
        agent: {
          id: agent.id,
          name: agent.name,
          primaryProvider: agent.primaryProvider,
          fallbackProvider: agent.fallbackProvider,
          systemPrompt: agent.systemPrompt,
          enabledTools: JSON.parse(agent.enabledToolsJson),
          createdAt: agent.createdAt.toISOString(),
          updatedAt: agent.updatedAt.toISOString(),
        },
      };
    }
  );

  /**
   * PUT /v1/agents/:agentId
   * Update an agent
   */
  fastify.put<{ Params: { agentId: string } }>(
    '/v1/agents/:agentId',
    async (request, reply) => {
      // Validate params
      const paramsResult = agentIdSchema.safeParse(request.params);
      if (!paramsResult.success) {
        throw validationError(
          'Invalid agent ID',
          { errors: paramsResult.error.errors },
          request.requestId
        );
      }

      // Validate body
      const bodyResult = updateAgentSchema.safeParse(request.body);
      if (!bodyResult.success) {
        throw validationError(
          'Invalid request body',
          { errors: bodyResult.error.errors },
          request.requestId
        );
      }

      const { agentId } = paramsResult.data;
      const data = bodyResult.data;

      const agent = await AgentService.updateAgent(
        request.tenant.id,
        agentId,
        data,
        request.requestId
      );

      return {
        agent: {
          id: agent.id,
          name: agent.name,
          primaryProvider: agent.primaryProvider,
          fallbackProvider: agent.fallbackProvider,
          systemPrompt: agent.systemPrompt,
          enabledTools: JSON.parse(agent.enabledToolsJson),
          createdAt: agent.createdAt.toISOString(),
          updatedAt: agent.updatedAt.toISOString(),
        },
      };
    }
  );
}
