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

export async function streamChatCompletion(
  messages: ChatMessage[],
  tools: McpTool[],
  onChunk: (text: string) => void,
  onComplete: () => void,
  onError: (error: Error) => void,
  onToolCall?: ToolCallHandler,
  provider: LLMProvider = 'neosantara'
) {
  try {
    const llmProvider = createLLMProvider(provider);
    const modelName = getModelName(provider);

    console.log(`🤖 Using ${provider} with model: ${modelName}`);
    console.log(`🔗 Endpoint: ${provider === 'neosantara' ? 'https://api.neosantara.xyz/v1/chat/completions' : 'https://api.groq.com/openai/v1/chat/completions'}`);
    console.log(`✓ Using Chat Completions API (not Responses API)`);

    // Convert MCP tools to AI SDK format
    const aiTools: Record<string, any> = {};
    tools.forEach(tool => {
      aiTools[tool.name] = {
        description: tool.description,
        parameters: tool.inputSchema,
        execute: async (args: Record<string, any>) => {
          if (onToolCall) {
            console.log(`🔧 Executing tool: ${tool.name}`, args);
            return await onToolCall(tool.name, args);
          }
          return null;
        },
      };
    });

    // Format messages for AI SDK
    const formattedMessages = messages
      .filter(m => m.role !== 'tool') // AI SDK handles tool results differently
      .map(m => ({
        role: m.role as 'user' | 'assistant' | 'system',
        content: m.content,
      }));

    const result = streamText({
      model: llmProvider(modelName), // Use standard model call for v4
      messages: formattedMessages,
      tools: Object.keys(aiTools).length > 0 ? aiTools : undefined,
      temperature: 0.5,
      maxSteps: 10, // Allow multiple tool call rounds
      onChunk: ({ chunk }) => {
        if (chunk.type === 'text-delta') {
          onChunk(chunk.textDelta);
        }
      },
      onFinish: ({ toolCalls }) => {
        console.log('✓ Stream finished');
        if (toolCalls && toolCalls.length > 0) {
          console.log('🔧 Tool calls executed:', toolCalls.length);
        }
        onComplete();
      },
    });

    // Wait for the stream to complete
    const fullText = await result.text;
    console.log('📝 Full response:', fullText);

  } catch (error) {
    console.error(`${provider} streaming error:`, error);
    onError(error instanceof Error ? error : new Error(String(error)));
    throw error;
  }
}
