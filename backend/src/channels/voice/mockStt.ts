/**
 * Mock Speech-to-Text (STT) Module
 * Generates deterministic transcripts from audio buffers for demo purposes
 */

/**
 * Transcribe audio to text using a mock implementation
 *
 * In a real implementation, this would call a service like:
 * - OpenAI Whisper API
 * - Google Cloud Speech-to-Text
 * - AWS Transcribe
 * - Azure Speech Services
 *
 * For demo purposes, we generate deterministic text based on audio characteristics
 *
 * @param audioBuffer - The audio file buffer
 * @param audioDurationMs - Optional audio duration in milliseconds
 * @returns Transcribed text
 */
export async function transcribeAudio(
  audioBuffer: Buffer,
  audioDurationMs?: number
): Promise<string> {
  // Generate deterministic transcript based on audio size
  const sizeKb = Math.round(audioBuffer.length / 1024);
  const duration = audioDurationMs ? Math.round(audioDurationMs / 1000) : 'unknown';

  // Create a simple hash from buffer to make it repeatable
  const hash = audioBuffer.length % 10;

  const phrases = [
    "Hello, I would like to inquire about your services.",
    "Can you help me with my account settings?",
    "I'm interested in learning more about your pricing plans.",
    "What are the features available in the premium tier?",
    "I need assistance with setting up my profile.",
    "Could you explain how the dashboard works?",
    "I'd like to report an issue I encountered.",
    "How do I upgrade my subscription?",
    "Can you provide more details about the API?",
    "I'm looking for information about your support options.",
  ];

  const selectedPhrase = phrases[hash];

  // Return a mock transcript with metadata
  return `${selectedPhrase} (Mock transcript: ${sizeKb}KB audio, ${duration}s duration)`;
}

/**
 * Extract audio duration from WAV header if available
 * This is a simplified implementation for demo purposes
 *
 * @param audioBuffer - The audio file buffer
 * @returns Duration in milliseconds, or null if cannot be determined
 */
export function extractAudioDuration(audioBuffer: Buffer): number | null {
  try {
    // Check if it's a WAV file (RIFF header)
    if (audioBuffer.length < 44) {
      return null;
    }

    const riff = audioBuffer.toString('ascii', 0, 4);
    if (riff !== 'RIFF') {
      return null;
    }

    const wave = audioBuffer.toString('ascii', 8, 12);
    if (wave !== 'WAVE') {
      return null;
    }

    // Read data chunk size (bytes 40-43)
    const dataSize = audioBuffer.readUInt32LE(40);

    // Read bytes per second (bytes 28-31)
    const byteRate = audioBuffer.readUInt32LE(28);

    if (byteRate === 0) {
      return null;
    }

    // Calculate duration in milliseconds
    const durationSeconds = dataSize / byteRate;
    return Math.round(durationSeconds * 1000);
  } catch (error) {
    return null;
  }
}
