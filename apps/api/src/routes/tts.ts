/**
 * @vanni/api — Text-to-Speech (TTS) Kannada Voice Synthesis Routes
 *
 * Exposes:
 * - POST /api/tts/synthesize
 * - GET  /api/tts/status
 */

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';

interface SynthesizeRequestBody {
  text: string;
  targetLanguageCode?: 'kn-IN' | 'te-IN' | 'hi-IN' | 'ta-IN' | 'en-IN';
  speaker?: 'kavya' | 'priya' | 'roopa' | 'aditya' | 'ratan';
  apiKey?: string;
  pace?: number;
}

export async function registerTtsRoutes(fastify: FastifyInstance) {
  fastify.get('/api/tts/status', async (_req: FastifyRequest, reply: FastifyReply) => {
    const hasSarvamKey = Boolean(process.env.SARVAM_API_KEY && !process.env.SARVAM_API_KEY.includes('placeholder'));
    return reply.send({
      success: true,
      provider: 'sarvam_bulbul',
      hasSarvamKey,
      availableSpeakers: [
        { id: 'kavya', name: 'Kavya (Kannada Native Female, Empathetic & Natural)', gender: 'Female' },
        { id: 'priya', name: 'Priya (Youthful Conversational Female)', gender: 'Female' },
        { id: 'roopa', name: 'Roopa (Warm Professional Female)', gender: 'Female' },
        { id: 'aditya', name: 'Aditya (Authoritative Executive Male)', gender: 'Male' },
        { id: 'ratan', name: 'Ratan (Friendly Commercial Male)', gender: 'Male' }
      ],
      supportedLanguages: ['kn-IN', 'en-IN'],
      model: process.env.SARVAM_TTS_MODEL?.trim() || 'bulbul:v4-flash'
    });
  });

  fastify.post('/api/tts/synthesize', async (req: FastifyRequest<{ Body: SynthesizeRequestBody }>, reply: FastifyReply) => {
    const { text, targetLanguageCode = 'kn-IN', speaker = 'kavya', apiKey, pace = 1.05 } = req.body || {};

    if (!text || typeof text !== 'string' || !text.trim()) {
      return reply.status(400).send({
        success: false,
        error: 'Missing required parameter: text'
      });
    }

    const keyToUse = apiKey || process.env.SARVAM_API_KEY;

    if (!keyToUse) {
      return reply.status(401).send({
        success: false,
        error: 'Missing SARVAM_API_KEY'
      });
    }

    try {
      const response = await fetch('https://api.sarvam.ai/text-to-speech', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'api-subscription-key': keyToUse
        },
        body: JSON.stringify({
          inputs: [text.trim()],
          target_language_code: targetLanguageCode,
          speaker: speaker,
          pitch: 0,
          pace: pace,
          loudness: 1.0,
          speech_sample_rate: 16000,
          enable_preprocessing: true,
          model: process.env.SARVAM_TTS_MODEL?.trim() || 'bulbul:v4-flash'
        })
      });

      if (!response.ok) {
        const errText = await response.text();
        return reply.status(response.status).send({
          success: false,
          error: `Sarvam API HTTP ${response.status}: ${errText}`
        });
      }

      const data = await response.json() as any;
      const audioBase64 = data.audios?.[0];

      if (!audioBase64) {
        return reply.status(502).send({
          success: false,
          error: 'Sarvam API returned empty audio'
        });
      }

      return reply.send({
        success: true,
        provider: 'sarvam_bulbul_v3',
        speaker,
        targetLanguageCode,
        audioBase64,
        format: 'wav',
        sampleRate: 16000
      });
    } catch (err: any) {
      return reply.status(500).send({
        success: false,
        error: `Internal synthesis error: ${err.message}`
      });
    }
  });
}
