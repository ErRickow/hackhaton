/**
 * useMcpTools Hook
 * Manages E2B sandbox, MCP server lifecycle, and MCP client
 */

import { useState, useEffect } from 'react';
import { startMcpSandbox } from '@netglade/mcp-sandbox';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { SSEClientTransport } from '@modelcontextprotocol/sdk/client/sse.js';
import type { UseMcpToolsReturn, McpTool, McpServer } from '@/types';

export function useMcpTools(): UseMcpToolsReturn {
  const [mcpServer, setMcpServer] = useState<McpServer | null>(null);
  const [mcpClient, setMcpClient] = useState<Client | null>(null);
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
      console.log('⏱️  This may take 30-60 seconds for first boot...');

      // Get E2B API key from localStorage
      const stored = window.localStorage.getItem('apilab_api_keys');
      const apiKeys = stored ? JSON.parse(stored) : {};
      const apiKey = apiKeys.e2b;

      if (!apiKey) {
        throw new Error('E2B API key not found. Please configure it in Settings.');
      }

      // Start the MCP server in E2B sandbox
      // Using fetch-mcp (official MCP server for HTTP requests)
      console.log('📦 Starting E2B sandbox...');
      const mcpSandbox = await startMcpSandbox({
        command: 'npx -y -p @modelcontextprotocol/server-fetch @modelcontextprotocol/server-fetch',
        apiKey,
        timeoutMs: 1000 * 60 * 15, // 15 minutes timeout
      });

      console.log('✅ MCP sandbox started successfully!');
      const serverUrl = mcpSandbox.getUrl();
      console.log('🔗 Server URL:', serverUrl);

      // Wait for MCP server to be fully ready (supergateway + MCP server boot time)
      console.log('⏳ Waiting for MCP server to initialize...');
      await new Promise(resolve => setTimeout(resolve, 10000)); // 10 seconds

      // Create MCP client with SSE transport
      console.log('🔌 Creating MCP client...');
      const client = new Client(
        {
          name: 'apilab-mcp-client',
          version: '1.0.0',
        },
        {
          capabilities: {},
        }
      );

      // Connect to MCP server via SSE
      console.log('🔌 Connecting to MCP server via SSE...');
      const transport = new SSEClientTransport(new URL(serverUrl));
      await client.connect(transport);
      console.log('✅ MCP client connected successfully!');

      // Get available tools from the MCP server
      let availableTools: McpTool[] = [];
      try {
        const toolsResponse = await client.listTools();
        console.log('✓ Raw tools response:', toolsResponse);

        // Convert MCP tools to our format
        availableTools = toolsResponse.tools.map((tool: any) => ({
          name: tool.name,
          description: tool.description || '',
          inputSchema: tool.inputSchema || {
            type: 'object',
            properties: {},
          },
        }));

        console.log('✓ Tools loaded from MCP server:', availableTools.length);
        console.log('  Available tools:', availableTools.map(t => t.name).join(', '));
      } catch (err) {
        console.warn('Could not load tools from MCP server, using defaults:', err);
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

      setMcpServer(mcpSandbox as any);
      setMcpClient(client);
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
    if (!mcpClient) {
      throw new Error('MCP client not initialized');
    }

    try {
      console.log(`🔧 Calling MCP tool: ${toolName}`, args);

      // Call the tool through the MCP client
      const result = await mcpClient.callTool({
        name: toolName,
        arguments: args,
      });

      console.log('✓ MCP tool result:', result);

      // Extract content from MCP response
      if (result.content && Array.isArray(result.content)) {
        // MCP returns content as array of content items
        const textContent = result.content
          .filter((item: any) => item.type === 'text')
          .map((item: any) => item.text)
          .join('\n');

        try {
          // Try to parse as JSON if it looks like JSON
          return JSON.parse(textContent);
        } catch {
          // Return as-is if not JSON
          return textContent;
        }
      }

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
