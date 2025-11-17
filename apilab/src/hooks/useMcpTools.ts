/**
 * useMcpTools Hook
 * Manages E2B sandbox and MCP server lifecycle (NetGlade pattern)
 */

import { useState, useEffect } from 'react';
import { startMcpSandbox } from '@netglade/mcp-sandbox';
import { experimental_createMCPClient } from 'ai';
import type { UseMcpToolsReturn,  McpServer } from '@/types';

export function useMcpTools(): UseMcpToolsReturn {
  const [mcpServer, setMcpServer] = useState<McpServer | null>(null);
  const [tools, setTools] = useState<any>({}); // Store AI SDK tools format directly!
  const [isStarting, setIsStarting] = useState(false);
  const [isReady, setIsReady] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  /**
   * Wait for MCP server to be ready by polling the URL
   * NetGlade pattern: retry up to maxAttempts with 6s delay
   */
  async function waitForServerReady(url: string, maxAttempts = 5): Promise<boolean> {
    console.log(`🔍 Testing server readiness at: ${url}`);
    for (let i = 0; i < maxAttempts; i++) {
      try {
        console.log(`📡 Attempt ${i + 1}/${maxAttempts}: Fetching ${url}...`);
        const response = await fetch(url);
        console.log(`📥 Response status: ${response.status} ${response.statusText}`);

        if (response.status === 200) {
          console.log(`✅ Server ready at ${url} after ${i + 1} attempts`);
          return true;
        }
        console.log(`⏳ Server not ready yet (attempt ${i + 1}/${maxAttempts}), status: ${response.status}`);
      } catch (err) {
        console.log(`⏳ Server connection failed (attempt ${i + 1}/${maxAttempts}):`, err instanceof Error ? err.message : String(err));
      }

      if (i < maxAttempts - 1) {
        console.log(`⌛ Waiting 6 seconds before next attempt...`);
        await new Promise(resolve => setTimeout(resolve, 6000));
      }
    }
    console.log(`❌ Server failed to become ready after ${maxAttempts} attempts`);
    return false;
  }

  const startHttpClient = async () => {
    if (isStarting || isReady) return;

    setIsStarting(true);
    setError(null);

    try {
      console.log('🚀 Starting HTTP Client MCP server in E2B sandbox...');
      console.log('⏱️  This may take 30-60 seconds for first boot...');

      // Get E2B API key from localStorage
      const stored = window.localStorage.getItem('apilab_api_keys');
      const apiKeys = stored ? JSON.parse(stored) : {};
      const apiKey = apiKeys.e2b;

      if (!apiKey) {
        throw new Error('E2B API key not found. Please configure it in Settings.');
      }

      // Start the MCP server in E2B sandbox (NetGlade pattern)
      console.log('📦 Starting E2B sandbox...');
      console.log('🔧 Using @modelcontextprotocol/server-brave-search (proven NetGlade winner package)');
      const mcpSandbox = await startMcpSandbox({
        command: 'npx -y @modelcontextprotocol/server-brave-search',
        apiKey,
        envs: {
          BRAVE_API_KEY: apiKeys.brave || '', // Optional: Brave API key for enhanced search
        },
        timeoutMs: 1000 * 60 * 5, // 5 minutes like NetGlade
      });

      const serverUrl = mcpSandbox.getUrl();
      console.log('✅ MCP sandbox started!');
      console.log('🔗 Server URL:', serverUrl);

      // Wait for MCP server to be fully ready (NetGlade pattern)
      console.log('⏳ Waiting for MCP server to be ready...');
      const isReady = await waitForServerReady(serverUrl, 5);

      if (!isReady) {
        throw new Error('MCP server failed to start within timeout period');
      }

      // Create MCP client using AI SDK (NetGlade pattern)
      console.log('🔌 Creating MCP client with AI SDK...');
      const aiClient = await experimental_createMCPClient({
        transport: {
          type: 'sse',
          url: serverUrl,
        },
      });

      // Get tools from client (NetGlade pattern)
      console.log('🔧 Fetching available tools...');
      const mcpTools = await aiClient.tools();
      console.log('✅ Tools loaded:', Object.keys(mcpTools).length);
      console.log('📋 Available tools:', Object.keys(mcpTools).join(', '));

      // Store tools in AI SDK format directly (NO conversion!)
      // This is the exact NetGlade pattern
      setMcpServer(mcpSandbox as any);
      setTools(mcpTools); // Store as-is!
      setIsReady(true);
      setIsStarting(false);

      console.log('✅ MCP server ready with tools:', Object.keys(mcpTools));
    } catch (err) {
      console.error('❌ Failed to start MCP server:', err);
      console.error('Error details:', {
        name: err instanceof Error ? err.name : 'Unknown',
        message: err instanceof Error ? err.message : String(err),
        stack: err instanceof Error ? err.stack : undefined,
      });
      setError(err instanceof Error ? err : new Error(String(err)));
      setIsStarting(false);
      setIsReady(false);
    }
  };

  const callTool = async (toolName: string, args: Record<string, any>) => {
    if (!tools || Object.keys(tools).length === 0) {
      throw new Error('MCP tools not initialized');
    }

    try {
      console.log(`🔧 Calling MCP tool: ${toolName}`, args);

      const tool = tools[toolName];

      if (!tool) {
        throw new Error(`Tool ${toolName} not found. Available: ${Object.keys(tools).join(', ')}`);
      }

      // Execute the tool (AI SDK pattern)
      const result = await tool.execute?.(args);
      console.log('✓ MCP tool result:', result);

      return result;
    } catch (error) {
      console.error('❌ MCP tool call failed:', error);
      throw error;
    }
  };

  // Auto-start on mount
  useEffect(() => {
    startHttpClient();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return {
    isStarting,
    isReady,
    tools,
    error,
    startHttpClient,
    mcpServer,
    callTool,
  };
}
