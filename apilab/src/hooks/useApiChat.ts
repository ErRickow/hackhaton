/**
 * useApiChat Hook
 * Manages AI chat with streaming and tool calling
 */

import { useState, useRef } from 'react';
import { useMcpTools } from './useMcpTools';
import { streamChatCompletion, type ChatMessage, type LLMProvider } from '@/lib/groq-client';
import type { UseApiChatReturn } from '@/types';
import type { ToolStatus } from '@/components/ToolExecutionCard';
import { useApiKeys } from './useLocalStorage';

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
  const { apiKeys } = useApiKeys();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [toolExecutions, setToolExecutions] = useState<ToolExecution[]>([]);
  const abortControllerRef = useRef<AbortController | null>(null);

  // Auto-detect available provider
  const getAvailableProvider = (): LLMProvider => {
    if (apiKeys.neosantara) return 'neosantara';
    if (apiKeys.groq) return 'groq';
    throw new Error('No LLM provider configured. Please add Neosantara or Groq API key in Settings.');
  };

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

    const systemPrompt = `You are APILab AI - an intelligent API testing assistant, similar to Postman but with AI capabilities.

You have access to the following MCP tools for making REAL API calls:
${toolList}

YOUR PRIMARY JOB: Execute real API calls based on user requests and report the results.

HOW TO USE TOOLS:
- When user says "call API X", "test endpoint Y", "make request to Z" → EXECUTE the actual API call using available tools
- When user provides HTTP method + URL + params → MAKE THE REAL REQUEST
- After calling a tool, ALWAYS provide a summary of:
  1. What API was called
  2. The response status/result
  3. Key data from the response
  4. Any errors encountered

EXAMPLES:
User: "Search for 'OpenAI' on DuckDuckGo"
You: [Call duckduckgo_search tool] → "I found 10 results about OpenAI: [summarize top results]"

User: "Look up the latest AI research papers"
You: [Call arxiv tool] → "Found 5 recent papers: [list titles and summaries]"

User: "Test the GitHub API for user 'octocat'"
You: [Call appropriate tool] → "API returned: [show response data]"

IMPORTANT:
- This is an API TESTING tool (like Postman), not just an information retrieval assistant
- You MUST actually EXECUTE the API calls, not just explain what they do
- Always show clear results after each tool call
- If a tool fails, explain the error clearly

Remember: You are here to EXECUTE and TEST APIs, not just search for information!`;

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
        // On each text chunk
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
        // On tool call start
        (toolCallId: string, toolName: string, args: Record<string, any>) => {
          console.log('🔧 Tool call started:', toolName, args);

          const newExecution: ToolExecution = {
            id: toolCallId,
            toolName,
            status: 'running',
            args,
            startTime: Date.now(),
          };
          setToolExecutions(prev => [...prev, newExecution]);
        },
        // On tool call complete
        (toolCallId: string, toolName: string, result: any) => {
          console.log('✅ Tool call completed:', toolName);

          // Check if result contains error
          const isError = result?.isError || result?.error;
          const status: ToolStatus = isError ? 'error' : 'complete';

          setToolExecutions(prev =>
            prev.map(exec =>
              exec.id === toolCallId
                ? {
                    ...exec,
                    status,
                    result: isError ? undefined : result,
                    error: isError ? (result?.error || JSON.stringify(result)) : undefined,
                    endTime: Date.now()
                  }
                : exec
            )
          );
        },
        // Provider - Auto-detect available provider
        getAvailableProvider()
      );
    } catch (err) {
      console.error('Failed to send message:', err);

      // If Neosantara fails and Groq is available, try fallback
      const errorMessage = err instanceof Error ? err.message : String(err);
      if (errorMessage.includes('Neosantara') && apiKeys.groq && apiKeys.neosantara) {
        console.log('⚠️ Neosantara failed, attempting fallback to Groq...');
        try {
          // Retry with Groq
          let assistantMessage2 = '';
          setMessages([...newMessages, { role: 'assistant', content: '' }]);

          await streamChatCompletion(
            messagesWithSystem,
            tools,
            (chunk) => {
              assistantMessage2 += chunk;
              setMessages([
                ...newMessages,
                { role: 'assistant', content: assistantMessage2 },
              ]);
            },
            () => {
              console.log('✓ Response complete (via Groq)');
              setIsLoading(false);
            },
            (err2) => {
              console.error('Groq fallback error:', err2);
              setError(err2);
              setIsLoading(false);
            },
            (toolCallId, toolName, args) => {
              const newExecution: ToolExecution = {
                id: toolCallId,
                toolName,
                status: 'running',
                args,
                startTime: Date.now(),
              };
              setToolExecutions(prev => [...prev, newExecution]);
            },
            (toolCallId, _toolName, result) => {
              const isError = result?.isError || result?.error;
              setToolExecutions(prev =>
                prev.map(exec =>
                  exec.id === toolCallId
                    ? {
                        ...exec,
                        status: isError ? 'error' : 'complete',
                        result: isError ? undefined : result,
                        error: isError ? (result?.error || JSON.stringify(result)) : undefined,
                        endTime: Date.now()
                      }
                    : exec
                )
              );
            },
            'groq'
          );
          return; // Success with fallback
        } catch (err2) {
          console.error('Groq fallback also failed:', err2);
          setError(new Error(`Both Neosantara and Groq failed. Neosantara: ${errorMessage}. Groq: ${err2 instanceof Error ? err2.message : String(err2)}`));
        }
      } else {
        setError(err instanceof Error ? err : new Error(String(err)));
      }

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
