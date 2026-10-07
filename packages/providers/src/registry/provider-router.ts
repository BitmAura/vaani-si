import {
  ILLMProvider,
  ISTTProvider,
  ITTSProvider,
  IEmbeddingProvider,
  LLMMessage,
  LLMTurnResponse,
  LLMOptions,
  LLMToolCall,
  SpeechTranscript,
  STTOptions,
  AudioPayload,
  TTSOptions,
  EmbeddingRequest,
  BatchEmbeddingRequest,
  EmbeddingResult,
  BatchEmbeddingResult,
  ProviderError,
} from '@vanni/provider-sdk';
import { withRetry, RetryPolicy } from './retry-policy.js';

export interface RoutingOptions {
  retryPolicy?: Partial<RetryPolicy>;
  timeoutMs?: number;
}

/**
 * Creates resilient proxy adapters that wrap primary and secondary providers with automatic fallback.
 */
export class ProviderRouter {
  /**
   * Wrap primary and optional fallback LLM providers.
   */
  static routeLLM(
    primary: ILLMProvider,
    fallback?: ILLMProvider,
    options: RoutingOptions = {}
  ): ILLMProvider {
    return {
      providerName: fallback ? `${primary.providerName}->${fallback.providerName}` : primary.providerName,

      async generateTurn(
        systemPrompt: string,
        history: LLMMessage[],
        userUtterance: string,
        opts?: LLMOptions
      ): Promise<LLMTurnResponse> {
        try {
          return await withRetry(
            () => primary.generateTurn(systemPrompt, history, userUtterance, opts),
            options.retryPolicy
          );
        } catch (err: unknown) {
          if (
            fallback &&
            err instanceof ProviderError &&
            (err.isRetryable || err.code === 'PROVIDER_UNAVAILABLE' || err.code === 'PROVIDER_TIMEOUT')
          ) {
            return await withRetry(
              () => fallback.generateTurn(systemPrompt, history, userUtterance, opts),
              options.retryPolicy
            );
          }
          throw err;
        }
      },

      async *streamTurn(
        systemPrompt: string,
        history: LLMMessage[],
        userUtterance: string,
        opts?: LLMOptions
      ): AsyncIterable<{ textChunk?: string; toolCall?: LLMToolCall }> {
        if (primary.streamTurn) {
          try {
            yield* primary.streamTurn(systemPrompt, history, userUtterance, opts);
            return;
          } catch (err: unknown) {
            if (
              fallback &&
              fallback.streamTurn &&
              err instanceof ProviderError &&
              (err.isRetryable || err.code === 'PROVIDER_UNAVAILABLE')
            ) {
              yield* fallback.streamTurn(systemPrompt, history, userUtterance, opts);
              return;
            }
            throw err;
          }
        }

        // Fallback to non-streaming if streamTurn not available
        const turn = await this.generateTurn(systemPrompt, history, userUtterance, opts);
        yield { textChunk: turn.content, toolCall: turn.toolCalls?.[0] };
      },
    };
  }

  /**
   * Wrap primary and optional fallback STT providers.
   */
  static routeSTT(
    primary: ISTTProvider,
    fallback?: ISTTProvider,
    options: RoutingOptions = {}
  ): ISTTProvider {
    return {
      providerName: fallback ? `${primary.providerName}->${fallback.providerName}` : primary.providerName,

      async transcribe(audioBuffer: Buffer, opts?: STTOptions): Promise<SpeechTranscript> {
        try {
          return await withRetry(() => primary.transcribe(audioBuffer, opts), options.retryPolicy);
        } catch (err: unknown) {
          if (
            fallback &&
            err instanceof ProviderError &&
            (err.isRetryable || err.code === 'PROVIDER_UNAVAILABLE' || err.code === 'PROVIDER_TIMEOUT')
          ) {
            return await withRetry(() => fallback.transcribe(audioBuffer, opts), options.retryPolicy);
          }
          throw err;
        }
      },
    };
  }

  /**
   * Wrap primary and optional fallback TTS providers.
   */
  static routeTTS(
    primary: ITTSProvider,
    fallback?: ITTSProvider,
    options: RoutingOptions = {}
  ): ITTSProvider {
    return {
      providerName: fallback ? `${primary.providerName}->${fallback.providerName}` : primary.providerName,

      async synthesize(text: string, opts?: TTSOptions): Promise<AudioPayload> {
        try {
          return await withRetry(() => primary.synthesize(text, opts), options.retryPolicy);
        } catch (err: unknown) {
          if (
            fallback &&
            err instanceof ProviderError &&
            (err.isRetryable || err.code === 'PROVIDER_UNAVAILABLE' || err.code === 'PROVIDER_TIMEOUT')
          ) {
            return await withRetry(() => fallback.synthesize(text, opts), options.retryPolicy);
          }
          throw err;
        }
      },
    };
  }

  /**
   * Wrap primary and optional fallback Embedding providers.
   */
  static routeEmbedding(
    primary: IEmbeddingProvider,
    fallback?: IEmbeddingProvider,
    options: RoutingOptions = {}
  ): IEmbeddingProvider {
    return {
      providerName: fallback ? `${primary.providerName}->${fallback.providerName}` : primary.providerName,
      modelName: primary.modelName,
      dimensions: primary.dimensions,

      async embedText(request: EmbeddingRequest, signal?: AbortSignal): Promise<EmbeddingResult> {
        try {
          return await withRetry(() => primary.embedText(request, signal), options.retryPolicy, signal);
        } catch (err: unknown) {
          if (fallback && err instanceof ProviderError && (err.isRetryable || err.code === 'PROVIDER_UNAVAILABLE')) {
            return await withRetry(() => fallback.embedText(request, signal), options.retryPolicy, signal);
          }
          throw err;
        }
      },

      async embedBatch(request: BatchEmbeddingRequest, signal?: AbortSignal): Promise<BatchEmbeddingResult> {
        try {
          return await withRetry(() => primary.embedBatch(request, signal), options.retryPolicy, signal);
        } catch (err: unknown) {
          if (fallback && err instanceof ProviderError && (err.isRetryable || err.code === 'PROVIDER_UNAVAILABLE')) {
            return await withRetry(() => fallback.embedBatch(request, signal), options.retryPolicy, signal);
          }
          throw err;
        }
      },

      async healthCheck(): Promise<boolean> {
        const primaryOk = await primary.healthCheck();
        if (primaryOk) return true;
        if (fallback) return await fallback.healthCheck();
        return false;
      },
    };
  }
}
