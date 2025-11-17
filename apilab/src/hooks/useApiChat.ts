/**
 * useApiChat Hook
 * Manages AI chat with streaming and tool calling
 */

import { useState, useRef } from 'react';
import { useMcpTools } from './useMcpTools';
import { streamChatCompletion, type ChatMessage } from '@/lib/groq-client';
import type { UseApiChatReturn } from '@/types';
import type { ToolStatus } from '@/components/ToolExecutionCard';

export interface ToolExecution {
  id: string;
  toolName: string;
  status: ToolStatus;
  args?: Record<string, any>;
  result?: any;
  error?: string;
  startTime?: number;
  endTime?: number;
}

export function useApiChat(): UseApiChatReturn {
  const { isReady, tools, callTool } = useMcpTools();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [toolExecutions, setToolExecutions] = useState<ToolExecution[]>([]);
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
    const toolList = Object.entries(tools || {})
      .map(([name, tool]: [string, any]) => `- ${name}: ${tool.description || 'No description'}`)
      .join('\n');

    const systemPrompt = `You are an API testing assistant. You can help users test web searches and information retrieval.

Available tools:
${toolList}

When a user asks you to search or find information:
1. Use the available tools to get the information
2. Present the results in a clear, organized way
3. Provide helpful context and explanations

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

          const executionId = `tool_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
          const startTime = Date.now();

          // Add pending execution
          const newExecution: ToolExecution = {
            id: executionId,
            toolName,
            status: 'running',
            args,
            startTime,
          };
          setToolExecutions(prev => [...prev, newExecution]);

          try {
            const result = await callTool(toolName, args);
            console.log('✓ Tool call result:', result);

            // Update to complete
            setToolExecutions(prev =>
              prev.map(exec =>
                exec.id === executionId
                  ? { ...exec, status: 'complete', result, endTime: Date.now() }
                  : exec
              )
            );

            return result;
          } catch (error) {
            console.error('❌ Tool call error:', error);

            // Update to error
            setToolExecutions(prev =>
              prev.map(exec =>
                exec.id === executionId
                  ? { ...exec, status: 'error', error: String(error), endTime: Date.now() }
                  : exec
              )
            );

            throw error;
          }
        },
        // Provider - using Neosantara AI
        'neosantara'
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

  const clearToolExecutions = () => {
    setToolExecutions([]);
  };

  return {
    messages: messages as any,
    input,
    isLoading,
    error,
    toolExecutions,
    handleInputChange,
    handleSubmit,
    stop,
    clearToolExecutions,
  };
}
