/**
 * Mock Text-to-Speech (TTS) Module
 * Generates simple WAV audio from text for demo purposes
 */

export interface AudioResponse {
  buffer: Buffer;
  mimeType: string;
  durationMs: number;
}

/**
 * Synthesize speech from text using a mock implementation
 *
 * In a real implementation, this would call a service like:
 * - OpenAI TTS API
 * - Google Cloud Text-to-Speech
 * - AWS Polly
 * - Azure Speech Services
 * - ElevenLabs
 *
 * For demo purposes, we generate a simple WAV file with silence
 *
 * @param text - The text to synthesize
 * @returns Audio response with buffer, mime type, and duration
 */
export async function synthesizeSpeech(text: string): Promise<AudioResponse> {
  // Estimate duration based on text length
  // Average speaking rate: ~150 words per minute = 2.5 words per second
  const wordCount = text.split(/\s+/).length;
  const durationSeconds = Math.max(1, Math.ceil(wordCount / 2.5));
  const durationMs = durationSeconds * 1000;

  // Generate a simple WAV file with silence
  const buffer = generateSilentWav(durationMs);

  return {
    buffer,
    mimeType: 'audio/wav',
    durationMs,
  };
}

/**
 * Generate a simple WAV file with silence
 * This creates a valid WAV file that can be played in browsers
 *
 * WAV file structure:
 * - RIFF header (12 bytes)
 * - fmt chunk (24 bytes)
 * - data chunk (8 bytes + audio data)
 *
 * @param durationMs - Duration in milliseconds
 * @returns WAV file buffer
 */
function generateSilentWav(durationMs: number): Buffer {
  const sampleRate = 22050; // 22.05 kHz (lower quality, smaller file)
  const numChannels = 1; // Mono
  const bitsPerSample = 16;
  const byteRate = (sampleRate * numChannels * bitsPerSample) / 8;
  const blockAlign = (numChannels * bitsPerSample) / 8;
  const numSamples = Math.floor((sampleRate * durationMs) / 1000);
  const dataSize = numSamples * blockAlign;

  // Total file size
  const fileSize = 44 + dataSize;
  const buffer = Buffer.alloc(fileSize);

  // RIFF header
  buffer.write('RIFF', 0);
  buffer.writeUInt32LE(fileSize - 8, 4); // File size - 8
  buffer.write('WAVE', 8);

  // fmt chunk
  buffer.write('fmt ', 12);
  buffer.writeUInt32LE(16, 16); // fmt chunk size
  buffer.writeUInt16LE(1, 20); // Audio format (1 = PCM)
  buffer.writeUInt16LE(numChannels, 22);
  buffer.writeUInt32LE(sampleRate, 24);
  buffer.writeUInt32LE(byteRate, 28);
  buffer.writeUInt16LE(blockAlign, 32);
  buffer.writeUInt16LE(bitsPerSample, 34);

  // data chunk
  buffer.write('data', 36);
  buffer.writeUInt32LE(dataSize, 40);

  // Audio data (silence = all zeros, already initialized by Buffer.alloc)
  // You could add a simple tone here if desired:
  // for (let i = 0; i < numSamples; i++) {
  //   const amplitude = Math.sin(2 * Math.PI * 440 * i / sampleRate) * 16000;
  //   buffer.writeInt16LE(amplitude, 44 + i * 2);
  // }

  return buffer;
}

/**
 * Alternative: Generate a simple tone instead of silence
 * This makes it more obvious that audio is playing
 *
 * @param durationMs - Duration in milliseconds
 * @param frequency - Tone frequency in Hz (default: 440 Hz = A4 note)
 * @returns WAV file buffer
 */
export function generateToneWav(durationMs: number, frequency: number = 440): Buffer {
  const sampleRate = 22050;
  const numChannels = 1;
  const bitsPerSample = 16;
  const byteRate = (sampleRate * numChannels * bitsPerSample) / 8;
  const blockAlign = (numChannels * bitsPerSample) / 8;
  const numSamples = Math.floor((sampleRate * durationMs) / 1000);
  const dataSize = numSamples * blockAlign;

  const fileSize = 44 + dataSize;
  const buffer = Buffer.alloc(fileSize);

  // RIFF header
  buffer.write('RIFF', 0);
  buffer.writeUInt32LE(fileSize - 8, 4);
  buffer.write('WAVE', 8);

  // fmt chunk
  buffer.write('fmt ', 12);
  buffer.writeUInt32LE(16, 16);
  buffer.writeUInt16LE(1, 20);
  buffer.writeUInt16LE(numChannels, 22);
  buffer.writeUInt32LE(sampleRate, 24);
  buffer.writeUInt32LE(byteRate, 28);
  buffer.writeUInt16LE(blockAlign, 32);
  buffer.writeUInt16LE(bitsPerSample, 34);

  // data chunk
  buffer.write('data', 36);
  buffer.writeUInt32LE(dataSize, 40);

  // Generate tone
  for (let i = 0; i < numSamples; i++) {
    // Simple sine wave with fade in/out to avoid clicks
    const t = i / sampleRate;
    const fadeIn = Math.min(1, i / (sampleRate * 0.01)); // 10ms fade in
    const fadeOut = Math.min(1, (numSamples - i) / (sampleRate * 0.01)); // 10ms fade out
    const envelope = fadeIn * fadeOut;
    const amplitude = Math.sin(2 * Math.PI * frequency * t) * 16000 * 0.3 * envelope;
    buffer.writeInt16LE(Math.round(amplitude), 44 + i * 2);
  }

  return buffer;
}
