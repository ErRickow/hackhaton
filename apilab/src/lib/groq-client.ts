/**
 * LLM Client
 * Multi-provider support: Neosantara AI (OpenAI-compatible) and Groq
 */

import Groq from 'groq-sdk';
import OpenAI from 'openai';

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

export function createLLMClient(provider: LLMProvider = 'neosantara'): OpenAI | Groq {
  const apiKeys = getApiKeys();

  if (provider === 'neosantara') {
    const apiKey = apiKeys.neosantara;

    if (!apiKey) {
      throw new Error('Neosantara API key not found. Please configure it in Settings.');
    }

    // Use OpenAI SDK with Neosantara baseURL
    return new OpenAI({
      apiKey,
      baseURL: 'https://api.neosantara.xyz/v1',
      dangerouslyAllowBrowser: true,
    });
  } else {
    const apiKey = apiKeys.groq;

    if (!apiKey) {
      throw new Error('Groq API key not found. Please configure it in Settings.');
    }

    return new Groq({
      apiKey,
      dangerouslyAllowBrowser: true,
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
    const client = createLLMClient(provider);
    const modelName = getModelName(provider);

    // Convert MCP tools to OpenAI/Groq format
    const formattedTools = tools.map(tool => ({
      type: 'function' as const,
      function: {
        name: tool.name,
        description: tool.description,
        parameters: tool.inputSchema,
      },
    }));

    console.log(`🤖 Using ${provider} with model: ${modelName}`);
    console.log(`🔗 BaseURL: ${provider === 'neosantara' ? 'https://api.neosantara.xyz/v1' : 'default groq'}`);

    // Format messages for API
    const formattedMessages = messages.map(m => {
      if (m.role === 'tool') {
        return {
          role: 'tool' as const,
          content: m.content,
          tool_call_id: m.tool_call_id!,
        };
      } else if (m.role === 'assistant' && m.tool_calls) {
        return {
          role: 'assistant' as const,
          content: m.content || null,
          tool_calls: m.tool_calls,
        };
      } else {
        return {
          role: m.role as 'user' | 'assistant' | 'system',
          content: m.content,
        };
      }
    });

    // Create stream - cast to any to handle union type
    const stream = await (client as any).chat.completions.create({
      messages: formattedMessages,
      model: modelName,
      temperature: 0.5,
      max_tokens: 1024,
      tools: formattedTools.length > 0 ? formattedTools : undefined,
      stream: true,
    });

    let fullResponse = '';
    let toolCalls: Array<{
      id: string;
      type: 'function';
      function: {
        name: string;
        arguments: string;
      };
    }> = [];
    let currentToolCall: any = null;

    for await (const chunk of stream) {
      const delta = chunk.choices[0]?.delta;

      // Handle text content
      if (delta?.content) {
        fullResponse += delta.content;
        onChunk(delta.content);
      }

      // Handle tool calls
      if (delta?.tool_calls) {
        for (const toolCall of delta.tool_calls) {
          if (toolCall.index !== undefined) {
            if (!currentToolCall || toolCall.index !== currentToolCall.index) {
              if (currentToolCall) {
                toolCalls.push(currentToolCall);
              }
              currentToolCall = {
                index: toolCall.index,
                id: toolCall.id || `call_${Date.now()}_${toolCall.index}`,
                type: 'function',
                function: {
                  name: toolCall.function?.name || '',
                  arguments: toolCall.function?.arguments || '',
                },
              };
            } else {
              // Accumulate arguments
              if (toolCall.function?.arguments) {
                currentToolCall.function.arguments += toolCall.function.arguments;
              }
            }
          }
        }
      }
    }

    // Add final tool call if exists
    if (currentToolCall) {
      toolCalls.push(currentToolCall);
    }

    // If there are tool calls and handler, execute them
    if (toolCalls.length > 0 && onToolCall) {
      console.log('🔧 Tool calls detected:', toolCalls.length);

      for (const toolCall of toolCalls) {
        try {
          const args = JSON.parse(toolCall.function.arguments);
          console.log(`📞 Calling tool: ${toolCall.function.name}`, args);

          const result = await onToolCall(toolCall.function.name, args);
          console.log(`✓ Tool result:`, result);

          // Add tool call and result to messages
          messages.push({
            role: 'assistant',
            content: '',
            tool_calls: [toolCall],
          });

          messages.push({
            role: 'tool',
            content: JSON.stringify(result),
            tool_call_id: toolCall.id,
          });
        } catch (error) {
          console.error(`❌ Tool call failed:`, error);
          messages.push({
            role: 'tool',
            content: JSON.stringify({ error: String(error) }),
            tool_call_id: toolCall.id,
          });
        }
      }

      // Continue conversation with tool results
      return streamChatCompletion(
        messages,
        tools,
        onChunk,
        onComplete,
        onError,
        onToolCall,
        provider
      );
    }

    onComplete();
    return fullResponse;
  } catch (error) {
    console.error(`${provider} streaming error:`, error);
    onError(error instanceof Error ? error : new Error(String(error)));
    throw error;
  }
}
