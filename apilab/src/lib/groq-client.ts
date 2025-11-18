/**
 * LLM Client using Vercel AI SDK
 * Multi-provider support: Neosantara AI and Groq
 */

import { createOpenAI } from '@ai-sdk/openai';
import { streamText } from 'ai';

export type LLMProvider = 'neosantara' | 'groq';

/**
 * Get API keys from localStorage
 */
function getApiKeys() {
  try {
    const stored = window.localStorage.getItem('apilab_api_keys');
    if (stored) {
      return JSON.parse(stored);
    }
  } catch (error) {
    console.error('Failed to load API keys from localStorage:', error);
  }
  return { neosantara: '', groq: '', e2b: '' };
}

export function createLLMProvider(provider: LLMProvider = 'neosantara') {
  const apiKeys = getApiKeys();

  if (provider === 'neosantara') {
    const apiKey = apiKeys.neosantara;

    if (!apiKey) {
      throw new Error('Neosantara API key not found. Please configure it in Settings.');
    }

    // Use AI SDK createOpenAI with Neosantara baseURL
    return createOpenAI({
      apiKey,
      baseURL: 'https://api.neosantara.xyz/v1',
    });
  } else {
    const apiKey = apiKeys.groq;

    if (!apiKey) {
      throw new Error('Groq API key not found. Please configure it in Settings.');
    }

    // Groq is also OpenAI-compatible
    return createOpenAI({
      apiKey,
      baseURL: 'https://api.groq.com/openai/v1',
    });
  }
}

export function getModelName(provider: LLMProvider = 'neosantara'): string {
  if (provider === 'neosantara') {
    return 'nusantara-base'; // Supports function calling
  } else {
    return 'llama-3.1-8b-instant'; // Groq model
  }
}

export interface ChatMessage {
  role: 'user' | 'assistant' | 'system' | 'tool';
  content: string;
  tool_call_id?: string;
  tool_calls?: Array<{
    id: string;
    type: 'function';
    function: {
      name: string;
      arguments: string;
    };
  }>;
}

export interface McpTool {
  name: string;
  description: string;
  inputSchema: Record<string, any>;
}

export interface ToolCallHandler {
  (toolName: string, args: Record<string, any>): Promise<any>;
}

export interface ToolCallStartHandler {
  (toolCallId: string, toolName: string, args: Record<string, any>): void;
}

export interface ToolCallCompleteHandler {
  (toolCallId: string, toolName: string, result: any): void;
}

export async function streamChatCompletion(
  messages: ChatMessage[],
  tools: any, // AI SDK tools format (from client.tools())
  onChunk: (text: string) => void,
  onComplete: () => void,
  onError: (error: Error) => void,
  onToolCallStart?: ToolCallStartHandler,
  onToolCallComplete?: ToolCallCompleteHandler,
  provider: LLMProvider = 'neosantara'
) {
  try {
    const llmProvider = createLLMProvider(provider);
    const modelName = getModelName(provider);

    console.log(`🤖 Using ${provider} with model: ${modelName}`);
    console.log(`🔧 Tools available: ${Object.keys(tools || {}).length}`);

    // Format messages for AI SDK
    const formattedMessages = messages
      .filter(m => m.role !== 'tool') // AI SDK handles tool results differently
      .map(m => ({
        role: m.role as 'user' | 'assistant' | 'system',
        content: m.content,
      }));

    // Track tool calls
    const toolCallsMap = new Map<string, { name: string; args: any }>();

    // Pass tools directly (NetGlade pattern - NO conversion!)
    await streamText({
      model: llmProvider(modelName),
      messages: formattedMessages,
      tools: tools || {}, // Pass AI SDK tools directly!
      maxSteps: 20, // Allow multiple tool call rounds (NetGlade uses 20)
      onChunk: ({ chunk }) => {
        // Handle different chunk types
        if (chunk.type === 'text-delta') {
          onChunk(chunk.textDelta);
        } else if (chunk.type === 'tool-call') {
          // Tool call started
          const toolCallId = chunk.toolCallId;
          const toolName = chunk.toolName;
          const args = chunk.args;

          toolCallsMap.set(toolCallId, { name: toolName, args });

          console.log(`🔧 Tool call started: ${toolName}`, args);
          onToolCallStart?.(toolCallId, toolName, args);
        } else if (chunk.type === 'tool-result') {
          // Tool call completed
          const toolCallId = chunk.toolCallId;
          const result = chunk.result;
          const toolCall = toolCallsMap.get(toolCallId);

          if (toolCall) {
            console.log(`✅ Tool call completed: ${toolCall.name}`);
            onToolCallComplete?.(toolCallId, toolCall.name, result);
          }
        }
      },
      onFinish: ({ text, toolCalls, toolResults, finishReason }) => {
        console.log('✓ Stream finished');
        console.log(`  Finish reason: ${finishReason}`);
        console.log(`  Total tool calls: ${toolCalls?.length || 0}`);
        console.log(`  Final text length: ${text?.length || 0} chars`);

        onComplete();
      },
    });

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error(`❌ ${provider} streaming error:`, errorMessage);

    // Provide helpful error messages
    let userFriendlyError: Error;

    if (errorMessage.includes('API key')) {
      userFriendlyError = new Error(`${provider === 'neosantara' ? 'Neosantara' : 'Groq'} API key is invalid or missing. Please check your Settings.`);
    } else if (errorMessage.includes('401')) {
      userFriendlyError = new Error(`Authentication failed with ${provider === 'neosantara' ? 'Neosantara' : 'Groq'}. Please verify your API key in Settings.`);
    } else if (errorMessage.includes('429')) {
      userFriendlyError = new Error(`Rate limit exceeded for ${provider === 'neosantara' ? 'Neosantara' : 'Groq'}. Please try again later.`);
    } else if (errorMessage.includes('timeout')) {
      userFriendlyError = new Error(`Request timed out. Please try again.`);
    } else {
      userFriendlyError = error instanceof Error ? error : new Error(errorMessage);
    }

    onError(userFriendlyError);
    throw userFriendlyError;
  }
}
