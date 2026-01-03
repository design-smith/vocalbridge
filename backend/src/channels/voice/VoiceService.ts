/**
 * Voice Service
 * Handles voice message processing by integrating STT, existing message pipeline, and TTS
 */

import * as SessionRepo from '../../repositories/SessionRepo';
import * as ConversationService from '../../services/ConversationService';
import * as mockStt from './mockStt';
import * as mockTts from './mockTts';
import { sessionNotFoundError } from '../../utils/errors';

/**
 * Voice message processing request
 */
export interface ProcessVoiceMessageRequest {
  tenantId: string;
  sessionId: string;
  audioBuffer: Buffer;
  audioDurationMs?: number;
  customerId?: string;
  metadata?: Record<string, unknown>;
  idempotencyKey: string;
  requestId: string;
}

/**
 * Voice message response
 * Matches the spec for frontend consumption
 */
export interface VoiceMessageResponse {
  sessionId: string;
  transcriptText: string;
  assistant: {
    id: string;
    content: string;
    createdAt: string;
  };
  audio: {
    mimeType: string;
    base64: string;
    durationMs: number;
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
    channel: string; // 'voice'
    audioDurationMs?: number;
  };
}

/**
 * Process a voice message through the complete pipeline:
 * 1. Validate session exists and belongs to tenant
 * 2. Transcribe audio to text (mock STT)
 * 3. Call existing ConversationService.sendMessage (handles idempotency, billing, etc.)
 * 4. Synthesize assistant response to audio (mock TTS)
 * 5. Return complete response with audio
 *
 * This function ensures voice messages are:
 * - Tenant-scoped
 * - Idempotent (no duplicate billing on retries)
 * - Billed correctly through existing pipeline
 * - Logged in provider_call_events and usage_events
 * - Retriable
 *
 * @param request - Voice message processing request
 * @returns Voice message response with transcript, assistant message, and audio
 */
export async function processVoiceMessage(
  request: ProcessVoiceMessageRequest
): Promise<VoiceMessageResponse> {
  const {
    tenantId,
    sessionId,
    audioBuffer,
    audioDurationMs,
    idempotencyKey,
    requestId,
  } = request;

  // STEP 1: VALIDATE SESSION
  const session = await SessionRepo.findById(tenantId, sessionId);
  if (!session) {
    throw sessionNotFoundError(sessionId, requestId);
  }

  // STEP 2: TRANSCRIBE AUDIO TO TEXT (Mock STT)
  // Extract duration from audio if not provided
  const detectedDuration = audioDurationMs || mockStt.extractAudioDuration(audioBuffer);
  const transcriptText = await mockStt.transcribeAudio(audioBuffer, detectedDuration || undefined);

  // STEP 3: CALL EXISTING MESSAGE PIPELINE
  // This handles:
  // - Idempotency checking and replay
  // - User message persistence
  // - Provider call with retry and fallback
  // - Assistant message persistence
  // - Usage event creation (exactly once)
  // - Idempotency record update
  const conversationResponse = await ConversationService.sendMessage(
    tenantId,
    sessionId,
    idempotencyKey,
    transcriptText,
    requestId
  );

  // STEP 4: SYNTHESIZE ASSISTANT RESPONSE TO AUDIO (Mock TTS)
  const audioResponse = await mockTts.synthesizeSpeech(conversationResponse.message.content);

  // STEP 5: BUILD VOICE RESPONSE
  const voiceResponse: VoiceMessageResponse = {
    sessionId,
    transcriptText,
    assistant: {
      id: conversationResponse.message.id,
      content: conversationResponse.message.content,
      createdAt: conversationResponse.message.createdAt.toISOString(),
    },
    audio: {
      mimeType: audioResponse.mimeType,
      base64: audioResponse.buffer.toString('base64'),
      durationMs: audioResponse.durationMs,
    },
    metadata: {
      ...conversationResponse.metadata,
      channel: 'voice',
      audioDurationMs: detectedDuration || undefined,
    },
  };

  return voiceResponse;
}
