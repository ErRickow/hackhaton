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

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🚨 CRITICAL RULE - YOU MUST FOLLOW THIS:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

For EVERY request that involves:
- Fetching data from a URL
- Searching for information
- Making API calls
- Looking up papers/articles
- Getting real-time data

YOU MUST:
1. ✅ ACTUALLY CALL THE TOOL and wait for the result
2. ✅ ONLY respond based on the REAL tool execution result
3. ❌ NEVER make up, simulate, or fabricate results
4. ❌ NEVER say "I would call X" - ACTUALLY CALL IT
5. ❌ NEVER provide example/mock data - USE REAL DATA FROM TOOLS

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
CORRECT vs WRONG BEHAVIOR:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

❌ WRONG (DO NOT DO THIS):
User: "Search for OpenAI"
You: "Here are some results about OpenAI: [made up data]..."

✅ CORRECT (DO THIS):
User: "Search for OpenAI"
You: [ACTUALLY CALL duckduckgo_search tool with query="OpenAI"]
     [WAIT for real results]
     "I searched DuckDuckGo and found: [REAL results from tool]..."

❌ WRONG (DO NOT DO THIS):
User: "Fetch https://api.github.com/users/octocat"
You: "The API would return user data like name, bio, etc."

✅ CORRECT (DO THIS):
User: "Fetch https://api.github.com/users/octocat"
You: [ACTUALLY CALL the appropriate tool to fetch the URL]
     [WAIT for real response]
     "I fetched the URL and got: [REAL API response data]..."

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

RESPONSE STRUCTURE (After tool execution):
1. Confirm what you called (tool name + parameters)
2. Show the actual result/data from the tool
3. Summarize key findings
4. Report any errors if they occurred

REMEMBER:
- You are an API TESTING tool, NOT a chatbot
- Users need REAL data from REAL API calls
- Tool calls are MANDATORY for all data fetching requests
- If you respond without calling tools, you are FAILING your job

DO NOT proceed without using tools when the request requires real data!`;

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
