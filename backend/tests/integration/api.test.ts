import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { FastifyInstance } from 'fastify';
import { createServer } from '../../src/server';
import { prisma } from '../../src/db/prisma';
import { generateTenantId, generateApiKeyId, generateAgentId } from '../../src/utils/ids';
import { generateApiKey, hashApiKey } from '../../src/utils/hash';

describe('API Integration Tests', () => {
  let server: FastifyInstance;
  let apiKey: string;
  let tenantId: string;
  let agentId: string;

  beforeAll(async () => {
    // Create server
    server = await createServer();

    // Clear database
    await prisma.idempotencyRecord.deleteMany();
    await prisma.usageEvent.deleteMany();
    await prisma.providerCallEvent.deleteMany();
    await prisma.message.deleteMany();
    await prisma.session.deleteMany();
    await prisma.agent.deleteMany();
    await prisma.apiKey.deleteMany();
    await prisma.tenant.deleteMany();

    // Create test tenant
    tenantId = generateTenantId();
    apiKey = generateApiKey();

    await prisma.tenant.create({
      data: {
        id: tenantId,
        name: 'Test Tenant',
      },
    });

    await prisma.apiKey.create({
      data: {
        id: generateApiKeyId(),
        tenantId,
        keyHash: hashApiKey(apiKey),
      },
    });

    // Create test agent with vendorA (low failure rate for tests)
    agentId = generateAgentId();
    await prisma.agent.create({
      data: {
        id: agentId,
        tenantId,
        name: 'Test Agent',
        primaryProvider: 'vendorA',
        fallbackProvider: 'vendorB',
        systemPrompt: 'You are a test assistant.',
        enabledToolsJson: '[]',
      },
    });
  });

  afterAll(async () => {
    await server.close();
    await prisma.$disconnect();
  });

  describe('Authentication', () => {
    it('should reject requests without API key', async () => {
      const response = await server.inject({
        method: 'GET',
        url: '/v1/me',
      });

      expect(response.statusCode).toBe(401);
      const body = JSON.parse(response.body);
      expect(body.error.code).toBe('INVALID_API_KEY');
    });

    it('should reject requests with invalid API key', async () => {
      const response = await server.inject({
        method: 'GET',
        url: '/v1/me',
        headers: {
          'x-api-key': 'invalid-key',
        },
      });

      expect(response.statusCode).toBe(401);
      const body = JSON.parse(response.body);
      expect(body.error.code).toBe('INVALID_API_KEY');
    });

    it('should accept requests with valid API key', async () => {
      const response = await server.inject({
        method: 'GET',
        url: '/v1/me',
        headers: {
          'x-api-key': apiKey,
        },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.tenant.id).toBe(tenantId);
      expect(body.tenant.name).toBe('Test Tenant');
      expect(body.pricing).toBeDefined();
    });
  });

  describe('Session Creation Flow', () => {
    it('should create a session successfully', async () => {
      const response = await server.inject({
        method: 'POST',
        url: '/v1/sessions',
        headers: {
          'x-api-key': apiKey,
          'content-type': 'application/json',
        },
        payload: {
          agentId,
          customerId: 'customer_test_001',
          metadata: { channel: 'test' },
        },
      });

      expect(response.statusCode).toBe(201);
      const body = JSON.parse(response.body);

      expect(body.session).toBeDefined();
      expect(body.session.id).toMatch(/^ses_/);
      expect(body.session.agentId).toBe(agentId);
      expect(body.session.customerId).toBe('customer_test_001');
      expect(body.session.status).toBe('active');
      expect(body.session.metadata).toEqual({ channel: 'test' });

      // Verify session exists in database
      const session = await prisma.session.findFirst({
        where: { id: body.session.id },
      });
      expect(session).toBeDefined();
      expect(session?.tenantId).toBe(tenantId);
    });

    it('should reject session creation with non-existent agent', async () => {
      const response = await server.inject({
        method: 'POST',
        url: '/v1/sessions',
        headers: {
          'x-api-key': apiKey,
          'content-type': 'application/json',
        },
        payload: {
          agentId: 'agt_nonexistent',
          customerId: 'customer_test_002',
        },
      });

      expect(response.statusCode).toBe(404);
      const body = JSON.parse(response.body);
      expect(body.error.code).toBe('AGENT_NOT_FOUND');
    });
  });

  describe('Idempotent Message Sending', () => {
    let sessionId: string;
    const idempotencyKey = 'test-idem-key-001';

    beforeAll(async () => {
      // Create a session for message tests
      const response = await server.inject({
        method: 'POST',
        url: '/v1/sessions',
        headers: {
          'x-api-key': apiKey,
          'content-type': 'application/json',
        },
        payload: {
          agentId,
          customerId: 'customer_msg_test',
        },
      });

      const body = JSON.parse(response.body);
      sessionId = body.session.id;
    });

    it('should send message successfully', async () => {
      const response = await server.inject({
        method: 'POST',
        url: `/v1/sessions/${sessionId}/messages`,
        headers: {
          'x-api-key': apiKey,
          'idempotency-key': idempotencyKey,
          'content-type': 'application/json',
        },
        payload: {
          role: 'user',
          content: 'Hello, this is a test message',
        },
      });

      expect(response.statusCode).toBe(201);
      const body = JSON.parse(response.body);

      // Verify message structure
      expect(body.message).toBeDefined();
      expect(body.message.id).toMatch(/^msg_/);
      expect(body.message.role).toBe('assistant');
      expect(body.message.content).toBeTruthy();

      // Verify metadata
      expect(body.metadata.agentId).toBe(agentId);
      expect(body.metadata.providerUsed).toMatch(/^vendor(A|B)$/);
      expect(body.metadata.idempotency.key).toBe(idempotencyKey);
      expect(body.metadata.idempotency.replayed).toBe(false);

      // Verify usage metadata
      expect(body.metadata.usage).toBeDefined();
      expect(body.metadata.usage.tokensIn).toBeGreaterThan(0);
      expect(body.metadata.usage.tokensOut).toBeGreaterThan(0);
      expect(body.metadata.usage.costUsd).toBeGreaterThan(0);

      // Verify attempts metadata
      expect(body.metadata.attempts).toBeDefined();
      expect(body.metadata.attempts.length).toBeGreaterThan(0);
      expect(body.metadata.attempts[0].provider).toMatch(/^vendor(A|B)$/);

      // Verify messages in database
      const messages = await prisma.message.findMany({
        where: { sessionId },
        orderBy: { createdAt: 'asc' },
      });

      expect(messages.length).toBe(2); // User + Assistant
      expect(messages[0].role).toBe('user');
      expect(messages[0].content).toBe('Hello, this is a test message');
      expect(messages[1].role).toBe('assistant');

      // Verify usage event created
      const usageEvents = await prisma.usageEvent.findMany({
        where: { sessionId },
      });

      expect(usageEvents.length).toBe(1);
      expect(usageEvents[0].tenantId).toBe(tenantId);
      expect(usageEvents[0].agentId).toBe(agentId);
    });

    it('should replay response with same idempotency key', async () => {
      // Send same request again with same idempotency key
      const response = await server.inject({
        method: 'POST',
        url: `/v1/sessions/${sessionId}/messages`,
        headers: {
          'x-api-key': apiKey,
          'idempotency-key': idempotencyKey,
          'content-type': 'application/json',
        },
        payload: {
          role: 'user',
          content: 'Hello, this is a test message',
        },
      });

      expect(response.statusCode).toBe(200); // 200, not 201
      const body = JSON.parse(response.body);

      // Verify it's replayed
      expect(body.metadata.idempotency.replayed).toBe(true);
      expect(body.metadata.idempotency.key).toBe(idempotencyKey);

      // Verify NO new messages created
      const messages = await prisma.message.findMany({
        where: { sessionId },
      });
      expect(messages.length).toBe(2); // Still only 2 messages

      // Verify NO new usage events
      const usageEvents = await prisma.usageEvent.findMany({
        where: { sessionId },
      });
      expect(usageEvents.length).toBe(1); // Still only 1 usage event
    });

    it('should reject message without idempotency key', async () => {
      const response = await server.inject({
        method: 'POST',
        url: `/v1/sessions/${sessionId}/messages`,
        headers: {
          'x-api-key': apiKey,
          'content-type': 'application/json',
        },
        payload: {
          role: 'user',
          content: 'Message without idempotency key',
        },
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.error.code).toBe('IDEMPOTENCY_KEY_REQUIRED');
    });
  });

  describe('Session Transcript', () => {
    let sessionId: string;

    beforeAll(async () => {
      // Create session and send a message
      const sessionResponse = await server.inject({
        method: 'POST',
        url: '/v1/sessions',
        headers: {
          'x-api-key': apiKey,
          'content-type': 'application/json',
        },
        payload: {
          agentId,
          customerId: 'customer_transcript_test',
        },
      });

      sessionId = JSON.parse(sessionResponse.body).session.id;

      // Send a message
      await server.inject({
        method: 'POST',
        url: `/v1/sessions/${sessionId}/messages`,
        headers: {
          'x-api-key': apiKey,
          'idempotency-key': 'transcript-test-001',
          'content-type': 'application/json',
        },
        payload: {
          role: 'user',
          content: 'Test message for transcript',
        },
      });
    });

    it('should retrieve session transcript', async () => {
      const response = await server.inject({
        method: 'GET',
        url: `/v1/sessions/${sessionId}/transcript`,
        headers: {
          'x-api-key': apiKey,
        },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);

      expect(body.session).toBeDefined();
      expect(body.session.id).toBe(sessionId);

      expect(body.messages).toBeDefined();
      expect(body.messages.length).toBe(2); // User + Assistant

      expect(body.events).toBeDefined();
      expect(body.events.length).toBeGreaterThan(0);
      expect(body.events[0].type).toBe('provider_call');
    });
  });

  describe('Usage Rollup', () => {
    it('should return usage rollup', async () => {
      const today = new Date().toISOString().split('T')[0];
      const response = await server.inject({
        method: 'GET',
        url: `/v1/usage/rollup?from=${today}&to=${today}`,
        headers: {
          'x-api-key': apiKey,
        },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);

      expect(body.range).toBeDefined();
      expect(body.totals).toBeDefined();
      expect(body.totals.sessions).toBeGreaterThan(0);
      expect(body.totals.messages).toBeGreaterThan(0);
      expect(body.totals.tokensTotal).toBeGreaterThan(0);
      expect(body.totals.costUsd).toBeGreaterThan(0);

      expect(body.byProvider).toBeDefined();
      expect(Array.isArray(body.byProvider)).toBe(true);

      expect(body.topAgentsByCost).toBeDefined();
      expect(Array.isArray(body.topAgentsByCost)).toBe(true);
    });
  });

  describe('Agent CRUD', () => {
    it('should list agents', async () => {
      const response = await server.inject({
        method: 'GET',
        url: '/v1/agents',
        headers: {
          'x-api-key': apiKey,
        },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);

      expect(body.agents).toBeDefined();
      expect(Array.isArray(body.agents)).toBe(true);
      expect(body.agents.length).toBeGreaterThan(0);
    });

    it('should create a new agent', async () => {
      const response = await server.inject({
        method: 'POST',
        url: '/v1/agents',
        headers: {
          'x-api-key': apiKey,
          'content-type': 'application/json',
        },
        payload: {
          name: 'New Test Agent',
          primaryProvider: 'vendorB',
          fallbackProvider: null,
          systemPrompt: 'You are a new test agent.',
          enabledTools: ['Tool1'],
        },
      });

      expect(response.statusCode).toBe(201);
      const body = JSON.parse(response.body);

      expect(body.agent).toBeDefined();
      expect(body.agent.name).toBe('New Test Agent');
      expect(body.agent.primaryProvider).toBe('vendorB');
      expect(body.agent.fallbackProvider).toBeNull();
    });
  });
});
