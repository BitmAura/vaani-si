/**
 * Audio Codec & Format Representation
 */
export type AudioEncoding = 'pcm16' | 'mulaw' | 'alaw' | 'opus' | 'wav';

export interface AudioFormat {
  encoding: AudioEncoding;
  sampleRate: 8000 | 16000 | 22050 | 24000 | 44100 | 48000;
  channels: 1 | 2; // mono | stereo
  bitDepth?: 8 | 16 | 24 | 32;
  frameDurationMs?: number; // e.g. 20ms standard RTP frame
}

/**
 * Discrete audio frame within a streaming session
 */
export interface AudioFrame {
  sequenceNumber: number;
  timestamp: number; // Unix epoch ms
  format: AudioFormat;
  payload: Buffer; // Raw audio payload bytes
  isSilence?: boolean;
}

/**
 * Standard Normalized Audio Format used across VANNI internally.
 * 16kHz, 16-bit, Mono PCM (LINEAR16).
 * Standard for Indian language STT engines (Sarvam Saaras, Google Cloud Speech, Whisper).
 */
export const NORMALIZED_AUDIO_FORMAT: AudioFormat = {
  encoding: 'pcm16',
  sampleRate: 16000,
  channels: 1,
  bitDepth: 16,
  frameDurationMs: 20, // 320 samples = 640 bytes per 20ms frame
};

/**
 * Telephony Audio Format (Exotel, Twilio standard G.711 / μ-law)
 * 8kHz, 8-bit, Mono μ-law (PCMU).
 */
export const TELEPHONY_AUDIO_FORMAT: AudioFormat = {
  encoding: 'mulaw',
  sampleRate: 8000,
  channels: 1,
  bitDepth: 8,
  frameDurationMs: 20, // 160 samples = 160 bytes per 20ms frame
};
