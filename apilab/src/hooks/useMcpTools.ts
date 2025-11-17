/**
 * useMcpTools Hook
 * Manages E2B sandbox and MCP server lifecycle
 */

import { useState, useEffect } from 'react';
import { startMcpSandbox } from '@netglade/mcp-sandbox';
import type { UseMcpToolsReturn, McpTool, McpServer } from '@/types';

export function useMcpTools(): UseMcpToolsReturn {
  const [mcpServer, setMcpServer] = useState<McpServer | null>(null);
  const [tools, setTools] = useState<McpTool[]>([]);
  const [isStarting, setIsStarting] = useState(false);
  const [isReady, setIsReady] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const startHttpClient = async () => {
    if (isStarting || isReady) return;

    setIsStarting(true);
    setError(null);

    try {
      console.log('🚀 Starting HTTP Client MCP server in E2B sandbox...');

      // Get E2B API key from localStorage
      const stored = window.localStorage.getItem('apilab_api_keys');
      const apiKeys = stored ? JSON.parse(stored) : {};
      const apiKey = apiKeys.e2b;

      if (!apiKey) {
        throw new Error('E2B API key not found. Please configure it in Settings.');
      }

      // Start the MCP server in E2B sandbox
      // Using @sylphlab/tools-fetch-mcp for HTTP requests
      const mcp = await startMcpSandbox({
        command: 'npx -y @sylphlab/tools-fetch-mcp',
        apiKey,
      });

      console.log('✓ MCP server started');
      console.log('  URL:', mcp.getUrl());

      // Get available tools from the MCP server
      let availableTools: McpTool[] = [];
      try {
        availableTools = await (mcp as any).listTools();
        console.log('✓ Tools loaded from MCP server:', availableTools.length);
        console.log('  Available tools:', availableTools.map(t => t.name).join(', '));
      } catch (error) {
        console.warn('Could not load tools from MCP server, using defaults:', error);
        // Fallback tools based on typical fetch-mcp capabilities
        availableTools = [
          {
            name: 'fetch',
            description: 'Make an HTTP request to a URL and return the response',
            inputSchema: {
              type: 'object',
              properties: {
                url: {
                  type: 'string',
                  description: 'The URL to fetch',
                },
                method: {
                  type: 'string',
                  description: 'HTTP method (GET, POST, PUT, DELETE, etc.)',
                  enum: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'HEAD', 'OPTIONS'],
                },
                headers: {
                  type: 'object',
                  description: 'HTTP headers as key-value pairs',
                },
                body: {
                  type: 'string',
                  description: 'Request body (for POST, PUT, PATCH)',
                },
              },
              required: ['url'],
            },
          },
        ];
      }
      console.log('✓ Tools ready:', availableTools.length);

      setMcpServer(mcp as any);
      setTools(availableTools);
      setIsReady(true);
      setIsStarting(false);

      console.log('✅ HTTP Client MCP ready!');
    } catch (err) {
      console.error('❌ Failed to start MCP server:', err);
      setError(err instanceof Error ? err : new Error(String(err)));
      setIsStarting(false);
      setIsReady(false);
    }
  };

  const callTool = async (toolName: string, args: Record<string, any>) => {
    if (!mcpServer) {
      throw new Error('MCP server not initialized');
    }

    try {
      console.log(`🔧 Calling MCP tool: ${toolName}`, args);

      // Call the tool through the MCP server
      // The MCP server should have a callTool method
      const result = await (mcpServer as any).callTool(toolName, args);

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
