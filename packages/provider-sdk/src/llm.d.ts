/**
 * VANNI Provider SDK — LLM Reasoning Layer Abstraction Contract
 */
export interface LLMMessage {
    role: 'system' | 'user' | 'assistant' | 'tool';
    content: string;
    name?: string;
    toolCallId?: string;
}
export interface LLMToolParameterSchema {
    type: 'object';
    properties: Record<string, {
        type: string;
        description: string;
        enum?: string[];
    }>;
    required?: string[];
}
export interface LLMToolDefinition {
    name: string;
    description: string;
    parameters: LLMToolParameterSchema;
}
export interface LLMToolCall {
    id: string;
    name: string;
    arguments: Record<string, any>;
}
export interface LLMTurnResponse {
    content: string;
    toolCalls?: LLMToolCall[];
    timeToFirstTokenMs?: number;
    totalDurationMs: number;
    usage?: {
        promptTokens: number;
        completionTokens: number;
        totalTokens: number;
    };
}
export interface LLMOptions {
    model?: string;
    temperature?: number;
    maxOutputTokens?: number;
    tools?: LLMToolDefinition[];
    timeoutMs?: number;
}
export interface ILLMProvider {
    readonly providerName: string;
    /**
     * Generates the conversational turn response with optional tool calls
     */
    generateTurn(systemPrompt: string, history: LLMMessage[], userUtterance: string, options?: LLMOptions): Promise<LLMTurnResponse>;
    /**
     * Streams text tokens in real time
     */
    streamTurn?(systemPrompt: string, history: LLMMessage[], userUtterance: string, options?: LLMOptions): AsyncIterable<{
        textChunk?: string;
        toolCall?: LLMToolCall;
    }>;
}
