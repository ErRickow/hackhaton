/**
 * useApiChat Hook
 * Manages AI chat with streaming and tool calling
 */

import { useState, useRef } from 'react';
import { useMcpTools } from './useMcpTools';
import { streamChatCompletion, type ChatMessage } from '@/lib/groq-client';
import type { UseApiChatReturn } from '@/types';

export function useApiChat(): UseApiChatReturn {
  const { isReady, tools, callTool } = useMcpTools();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setInput(e.target.value);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!isReady) {
      setError(new Error('MCP server not ready yet. Please wait...'));
      return;
    }

    if (!input.trim()) {
      return;
    }

    const userMessage = input.trim();
    setInput('');
    setError(null);
    setIsLoading(true);

    // Add user message
    const newMessages: ChatMessage[] = [
      ...messages,
      { role: 'user', content: userMessage },
    ];
    setMessages(newMessages);

    // Create system prompt with tool info
    const systemPrompt = `You are an API testing assistant. You can help users test APIs by making HTTP requests.

Available tools:
${tools.map(t => `- ${t.name}: ${t.description}`).join('\n')}

When a user asks to test an API:
1. Extract the URL, method, headers, and any data needed
2. Make the appropriate HTTP request
3. Explain the response in a clear, helpful way

Be concise but informative.`;

    const messagesWithSystem: ChatMessage[] = [
      { role: 'system', content: systemPrompt },
      ...newMessages,
    ];

    // Prepare for streaming response
    let assistantMessage = '';
    setMessages([...newMessages, { role: 'assistant', content: '' }]);

    try {
      await streamChatCompletion(
        messagesWithSystem,
        tools, // Pass the MCP tools
        // On each chunk
        (chunk) => {
          assistantMessage += chunk;
          setMessages([
            ...newMessages,
            { role: 'assistant', content: assistantMessage },
          ]);
        },
        // On complete
        () => {
          console.log('✓ Response complete');
          setIsLoading(false);
        },
        // On error
        (err) => {
          console.error('Chat error:', err);
          setError(err);
          setIsLoading(false);
        },
        // Tool call handler
        async (toolName: string, args: Record<string, any>) => {
          console.log('🔧 Tool call requested:', toolName, args);
          try {
            const result = await callTool(toolName, args);
            console.log('✓ Tool call result:', result);
            return result;
          } catch (error) {
            console.error('❌ Tool call error:', error);
            throw error;
          }
        }
      );
    } catch (err) {
      console.error('Failed to send message:', err);
      setError(err instanceof Error ? err : new Error(String(err)));
      setIsLoading(false);

      // Remove empty assistant message on error
      setMessages(newMessages);
    }
  };

  const stop = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      setIsLoading(false);
    }
  };

  return {
    messages: messages as any,
    input,
    isLoading,
    error,
    handleInputChange,
    handleSubmit,
    stop,
  };
}
