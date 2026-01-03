/**
 * Voice Channel Routes
 * POST /v1/sessions/:sessionId/voice - Send voice message to a session
 */

import { FastifyInstance } from 'fastify';
import * as VoiceService from './VoiceService';
import { validationError } from '../../utils/errors';

export async function voiceRoutes(fastify: FastifyInstance): Promise<void> {
  /**
   * POST /v1/sessions/:sessionId/voice
   * Send a voice message to a conversation session
   *
   * This endpoint:
   * - Accepts audio file upload via multipart/form-data
   * - Transcribes audio to text (mock STT)
   * - Calls existing message pipeline (idempotent, billed, logged)
   * - Synthesizes assistant response to audio (mock TTS)
   * - Returns transcript, assistant message, and audio response
   *
   * Headers:
   * - X-API-Key: required (tenant auth)
   * - Idempotency-Key: required (prevents duplicate billing on retries)
   *
   * Body (multipart/form-data):
   * - audio: file (required) - audio file to transcribe
   * - customerId: string (optional) - customer identifier
   * - metadata: JSON string (optional) - additional metadata
   * - audioDurationMs: number (optional) - audio duration in milliseconds
   */
  fastify.post('/v1/sessions/:sessionId/voice', async (request) => {
    const { sessionId } = request.params as { sessionId: string };

    // Validate Idempotency-Key header
    const idempotencyKey = request.headers['idempotency-key'] as string | undefined;
    if (!idempotencyKey) {
      throw validationError(
        'Idempotency-Key header is required for voice messages',
        { header: 'Idempotency-Key' },
        request.requestId
      );
    }

    // Parse multipart form data
    const parts = request.parts();
    let audioBuffer: Buffer | null = null;
    let audioDurationMs: number | undefined = undefined;
    const customerId: string | undefined = undefined;
    const metadata: Record<string, unknown> | undefined = undefined;

    for await (const part of parts) {
      if (part.type === 'file' && part.fieldname === 'audio') {
        // Read audio file
        audioBuffer = await part.toBuffer();
      } else if (part.type === 'field' && part.fieldname === 'audioDurationMs') {
        // Parse duration from form field
        const durationValue = (part as any).value;
        const parsed = parseInt(durationValue, 10);
        if (!isNaN(parsed)) {
          audioDurationMs = parsed;
        }
      }
    }

    if (!audioBuffer) {
      throw validationError(
        'No audio file provided. Expected multipart/form-data with "audio" field.',
        { field: 'audio' },
        request.requestId
      );
    }

    if (audioBuffer.length === 0) {
      throw validationError(
        'Audio file is empty',
        { field: 'audio', size: 0 },
        request.requestId
      );
    }

    // Process voice message
    const voiceResponse = await VoiceService.processVoiceMessage({
      tenantId: request.tenant.id,
      sessionId,
      audioBuffer,
      audioDurationMs,
      customerId,
      metadata,
      idempotencyKey,
      requestId: request.requestId,
    });

    return voiceResponse;
  });
}
