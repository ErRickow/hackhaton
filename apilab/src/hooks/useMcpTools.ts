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
   * NetGlade pattern: retry up to maxAttempts with delay
   */
  async function waitForServerReady(url: string, maxAttempts = 10): Promise<boolean> {
    console.log(`🔍 Testing server readiness at: ${url}`);
    console.log(`⏱️  Will try ${maxAttempts} times with 8 second delays`);

    for (let i = 0; i < maxAttempts; i++) {
      try {
        console.log(`\n📡 Attempt ${i + 1}/${maxAttempts}: Fetching ${url}...`);
        const response = await fetch(url, {
          method: 'GET',
          headers: { 'Accept': 'text/event-stream' }
        });

        console.log(`📥 Response status: ${response.status} ${response.statusText}`);
        console.log(`📥 Response headers:`, Object.fromEntries(response.headers.entries()));

        if (response.ok) {
          const contentType = response.headers.get('content-type');
          console.log(`✅ Server ready! Content-Type: ${contentType}`);
          return true;
        }

        // Try to read response body for more info
        try {
          const text = await response.text();
          console.log(`📄 Response body:`, text.substring(0, 200));
        } catch {
          console.log(`📄 Could not read response body`);
        }

        console.log(`⏳ Server not ready yet (attempt ${i + 1}/${maxAttempts})`);
      } catch (err) {
        console.log(`⏳ Server connection failed (attempt ${i + 1}/${maxAttempts}):`);
        console.error(err);
      }

      if (i < maxAttempts - 1) {
        console.log(`⌛ Waiting 8 seconds before next attempt...`);
        await new Promise(resolve => setTimeout(resolve, 8000));
      }
    }
    console.log(`\n❌ Server failed to become ready after ${maxAttempts} attempts`);
    console.log(`❌ Total time waited: ${maxAttempts * 8} seconds`);
    return false;
  }

  const startHttpClient = async () => {
    if (isStarting || isReady) return;

    setIsStarting(true);
    setError(null);

    try {
      console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.log('🚀 Starting MCP Server in E2B Sandbox');
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
      console.log('⏱️  This may take 30-90 seconds for first boot...\n');

      // Get E2B API key from localStorage
      const stored = window.localStorage.getItem('apilab_api_keys');
      const apiKeys = stored ? JSON.parse(stored) : {};
      const apiKey = apiKeys.e2b;

      console.log('🔑 Checking API keys...');
      console.log(`   E2B API key: ${apiKey ? '✅ Found (length: ' + apiKey.length + ')' : '❌ Not found'}`);

      if (!apiKey) {
        throw new Error('E2B API key not found. Please configure it in Settings.');
      }

      // Start the MCP server in E2B sandbox (NetGlade pattern)
      console.log('\n📦 Step 1: Creating E2B sandbox...');
      console.log('🔧 Using simple weather server for testing');
      console.log('⏱️  Calling startMcpSandbox...\n');

      const mcpSandbox = await startMcpSandbox({
        command: 'npx -y @modelcontextprotocol/server-weather',
        apiKey,
        envs: {},
        timeoutMs: 1000 * 60 * 10, // 10 minutes timeout
      });

      const serverUrl = mcpSandbox.getUrl();
      console.log('\n✅ MCP sandbox created successfully!');
      console.log('🔗 Server URL:', serverUrl);
      console.log('📝 This URL points to the SSE endpoint\n');

      // Wait for MCP server to be fully ready (NetGlade pattern)
      console.log('📡 Step 2: Waiting for MCP server to be ready...');
      const isReady = await waitForServerReady(serverUrl, 10);

      if (!isReady) {
        throw new Error('MCP server failed to start within timeout period (80 seconds)');
      }

      // Create MCP client using AI SDK (NetGlade pattern)
      console.log('\n🔌 Step 3: Creating MCP client with AI SDK...');
      console.log('📝 Using experimental_createMCPClient with SSE transport\n');

      const aiClient = await experimental_createMCPClient({
        transport: {
          type: 'sse',
          url: serverUrl,
        },
      });

      console.log('✅ MCP client created successfully!\n');

      // Get tools from client (NetGlade pattern)
      console.log('🔧 Step 4: Fetching available tools from MCP server...');
      const mcpTools = await aiClient.tools();

      console.log('\n✅ Tools loaded successfully!');
      console.log(`📊 Total tools: ${Object.keys(mcpTools).length}`);
      console.log('📋 Available tools:');
      Object.keys(mcpTools).forEach(toolName => {
        console.log(`   - ${toolName}`);
      });

      // Store tools in AI SDK format directly (NO conversion!)
      // This is the exact NetGlade pattern
      setMcpServer(mcpSandbox as any);
      setTools(mcpTools); // Store as-is!
      setIsReady(true);
      setIsStarting(false);

      console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.log('✅ MCP Server Ready!');
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    } catch (err) {
      console.error('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.error('❌ MCP Server Initialization Failed');
      console.error('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
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
