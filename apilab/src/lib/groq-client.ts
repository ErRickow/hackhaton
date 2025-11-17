/**
 * Groq Client
 * Direct client-side Groq API calls for quick prototyping
 */

import Groq from 'groq-sdk';

export function createGroqClient() {
  const apiKey = import.meta.env.VITE_GROQ_API_KEY;

  if (!apiKey) {
    throw new Error('Groq API key not found. Please set VITE_GROQ_API_KEY in .env file.');
  }

  return new Groq({
    apiKey,
    dangerouslyAllowBrowser: true, // For dev only - move to backend in production!
  });
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
  onToolCall?: ToolCallHandler
) {
  try {
    const groq = createGroqClient();

    // Convert MCP tools to Groq format
    const groqTools = tools.map(tool => ({
      type: 'function' as const,
      function: {
        name: tool.name,
        description: tool.description,
        parameters: tool.inputSchema,
      },
    }));

    const stream = await groq.chat.completions.create({
      messages: messages.map(m => {
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
      }),
      model: 'llama-3.1-8b-instant',
      temperature: 0.5,
      max_tokens: 1024,
      tools: groqTools.length > 0 ? groqTools : undefined,
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
        onToolCall
      );
    }

    onComplete();
    return fullResponse;
  } catch (error) {
    console.error('Groq streaming error:', error);
    onError(error instanceof Error ? error : new Error(String(error)));
    throw error;
  }
}
