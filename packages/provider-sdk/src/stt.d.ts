/**
 * VANNI Provider SDK — Speech-to-Text (STT) Abstraction Contract
 */
export interface SpeechTranscript {
    text: string;
    languageCode: string;
    confidence: number;
    isFinal: boolean;
    durationMs?: number;
}
export interface STTOptions {
    languageCode?: 'kn-IN' | 'te-IN' | 'hi-IN' | 'ta-IN' | 'en-IN';
    sampleRate?: 8000 | 16000;
    encoding?: 'LINEAR16' | 'MULAW' | 'ALAW' | 'OGG_OPUS';
    model?: string;
    enableVAD?: boolean;
}
export interface ISTTProvider {
    readonly providerName: string;
    /**
     * Transcribe a discrete buffer of raw audio (e.g. at the end of a speech burst)
     */
    transcribe(audioBuffer: Buffer, options?: STTOptions): Promise<SpeechTranscript>;
    /**
     * Bi-directional streaming speech recognition for real-time turn detection
     */
    createStreamSession?(options?: STTOptions): {
        write(chunk: Buffer): void;
        onTranscript(callback: (transcript: SpeechTranscript) => void): void;
        onError(callback: (error: Error) => void): void;
        end(): Promise<void>;
    };
}
