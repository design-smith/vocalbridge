/**
 * Conversation Service
 * Handles the complete sendMessage pipeline with idempotency, provider calls, and usage tracking
 */

import { Message } from '../generated/prisma';
import * as SessionRepo from '../repositories/SessionRepo';
import * as AgentRepo from '../repositories/AgentRepo';
import * as MessageRepo from '../repositories/MessageRepo';
import * as IdempotencyRepo from '../repositories/IdempotencyRepo';
import * as UsageEventRepo from '../repositories/UsageEventRepo';
import { VendorAAdapter } from '../providers/vendorA/adapter';
import { VendorBAdapter } from '../providers/vendorB/adapter';
import { ProviderAdapter, ProviderRequest } from '../providers/types';
import { callProviderWithFallback } from '../reliability/providerCaller';
import { calculateCost, ProviderName } from '../billing/pricing';
import {
  generateMessageId,
  generateIdempotencyId,
  generateEventId,
} from '../utils/ids';
import { computeRequestHash } from '../utils/hash';
import {
  sessionNotFoundError,
  agentNotFoundError,
  idempotencyKeyRequiredError,
  allProvidersFailedError,
} from '../utils/errors';

/**
 * Send message response with full metadata
 */
export interface SendMessageResponse {
  message: {
    id: string;
    sessionId: string;
    role: string;
    content: string;
    createdAt: Date;
  };
  metadata: {
    agentId: string;
    providerUsed: string;
    primaryAttempted: string;
    fallbackAttempted: string | null;
    fallbackUsed: boolean;
    attempts: Array<{
      provider: string;
      status: 'success' | 'failed';
      httpStatus: number | null;
      latencyMs: number;
      retries: number;
      errorCode: string | null;
    }>;
    usage: {
      tokensIn: number;
      tokensOut: number;
      costUsd: number;
      pricing: {
        usdPer1kTokens: number;
      };
    };
    idempotency: {
      key: string;
      replayed: boolean;
    };
    requestId: string;
  };
}

/**
 * Send a message in a conversation session (IDEMPOTENT)
 *
 * This is the most critical function in the system. It implements:
 * 1. Idempotency checking and replay
 * 2. User message persistence
 * 3. Provider call with retry and fallback
 * 4. Assistant message persistence
 * 5. Usage event creation (exactly once)
 * 6. Idempotency record update
 */
export async function sendMessage(
  tenantId: string,
  sessionId: string,
  idempotencyKey: string | undefined,
  userMessageContent: string,
  requestId: string
): Promise<SendMessageResponse> {
  // Validate idempotency key is provided
  if (!idempotencyKey) {
    throw idempotencyKeyRequiredError(requestId);
  }

  // STEP 1: IDEMPOTENCY CHECK
  const existingRecord = await IdempotencyRepo.lookup(
    tenantId,
    'send_message',
    idempotencyKey
  );

  if (existingRecord && existingRecord.responseJson) {
    // Replay existing response
    const storedResponse = JSON.parse(
      existingRecord.responseJson
    ) as SendMessageResponse;

    // Mark as replayed
    storedResponse.metadata.idempotency.replayed = true;

    return storedResponse;
  }

  // STEP 2: CREATE IDEMPOTENCY PLACEHOLDER
  const requestHash = computeRequestHash({
    tenantId,
    sessionId,
    content: userMessageContent,
  });

  const idempotencyRecord = await IdempotencyRepo.create({
    id: generateIdempotencyId(),
    tenantId,
    scope: 'send_message',
    idempotencyKey,
    sessionId,
    requestHash,
  });

  // If the record already has a response, it means another concurrent request won
  if (idempotencyRecord.responseJson) {
    const storedResponse = JSON.parse(
      idempotencyRecord.responseJson
    ) as SendMessageResponse;
    storedResponse.metadata.idempotency.replayed = true;
    return storedResponse;
  }

  // STEP 3: VALIDATE SESSION & AGENT
  const session = await SessionRepo.findById(tenantId, sessionId);
  if (!session) {
    throw sessionNotFoundError(sessionId, requestId);
  }

  const agent = await AgentRepo.findById(tenantId, session.agentId);
  if (!agent) {
    throw agentNotFoundError(session.agentId, requestId);
  }

  // STEP 4: PERSIST USER MESSAGE
  const userMessageId = generateMessageId();
  await MessageRepo.create({
    id: userMessageId,
    tenantId,
    sessionId,
    role: 'user',
    content: userMessageContent,
  });

  // Update session activity
  await SessionRepo.updateLastActivity(sessionId);

  // STEP 5: BUILD CONVERSATION HISTORY
  const previousMessages = await MessageRepo.listBySession(tenantId, sessionId);
  const conversationHistory: ProviderRequest = {
    systemPrompt: agent.systemPrompt,
    messages: previousMessages.map((msg) => ({
      role: msg.role as 'user' | 'assistant',
      content: msg.content,
    })),
    enabledTools: JSON.parse(agent.enabledToolsJson),
  };

  // STEP 6: GET PROVIDER ADAPTERS
  const primaryProvider = getProviderAdapter(agent.primaryProvider);
  const fallbackProvider = agent.fallbackProvider
    ? getProviderAdapter(agent.fallbackProvider)
    : null;

  // STEP 7: CALL PROVIDER WITH RETRY AND FALLBACK
  const providerResult = await callProviderWithFallback(
    primaryProvider,
    fallbackProvider,
    conversationHistory,
    undefined, // Use default retry config
    {
      tenantId,
      sessionId,
      agentId: agent.id,
      requestId,
    }
  );

  if (!providerResult.success || !providerResult.response) {
    throw allProvidersFailedError(
      {
        primary: agent.primaryProvider,
        fallback: agent.fallbackProvider,
        attempts: providerResult.attempts,
      },
      requestId
    );
  }

  const response = providerResult.response;

  // STEP 8: PERSIST ASSISTANT MESSAGE
  const assistantMessageId = generateMessageId();
  const assistantMessage = await MessageRepo.create({
    id: assistantMessageId,
    tenantId,
    sessionId,
    role: 'assistant',
    content: response.text,
  });

  // STEP 9: CALCULATE COST AND CREATE USAGE EVENT
  const cost = calculateCost(
    providerResult.providerUsed as ProviderName,
    response.tokensIn,
    response.tokensOut
  );

  await UsageEventRepo.create({
    id: generateEventId(),
    tenantId,
    sessionId,
    agentId: agent.id,
    provider: providerResult.providerUsed,
    tokensIn: response.tokensIn,
    tokensOut: response.tokensOut,
    costUsd: cost,
    requestId,
  });

  // STEP 10: BUILD RESPONSE
  const sendMessageResponse: SendMessageResponse = {
    message: {
      id: assistantMessage.id,
      sessionId: assistantMessage.sessionId,
      role: assistantMessage.role,
      content: assistantMessage.content,
      createdAt: assistantMessage.createdAt,
    },
    metadata: {
      agentId: agent.id,
      providerUsed: providerResult.providerUsed,
      primaryAttempted: agent.primaryProvider,
      fallbackAttempted: agent.fallbackProvider,
      fallbackUsed: providerResult.fallbackUsed,
      attempts: providerResult.attempts.map((attempt) => ({
        provider: attempt.provider,
        status: attempt.status,
        httpStatus: attempt.httpStatus,
        latencyMs: attempt.latencyMs,
        retries: attempt.retries,
        errorCode: attempt.errorCode,
      })),
      usage: {
        tokensIn: response.tokensIn,
        tokensOut: response.tokensOut,
        costUsd: cost,
        pricing: {
          usdPer1kTokens:
            providerResult.providerUsed === 'vendorA' ? 0.002 : 0.003,
        },
      },
      idempotency: {
        key: idempotencyKey,
        replayed: false,
      },
      requestId,
    },
  };

  // STEP 11: UPDATE IDEMPOTENCY RECORD
  await IdempotencyRepo.updateResponse(
    tenantId,
    'send_message',
    idempotencyKey,
    JSON.stringify(sendMessageResponse)
  );

  return sendMessageResponse;
}

/**
 * Get provider adapter by name
 */
function getProviderAdapter(providerName: string): ProviderAdapter {
  if (providerName === 'vendorA') {
    return new VendorAAdapter();
  } else if (providerName === 'vendorB') {
    return new VendorBAdapter();
  } else {
    throw new Error(`Unknown provider: ${providerName}`);
  }
}
