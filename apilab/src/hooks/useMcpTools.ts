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

      const apiKey = import.meta.env.VITE_E2B_API_KEY;
      if (!apiKey) {
        throw new Error('E2B API key not found. Please set VITE_E2B_API_KEY in .env file.');
      }

      // Start the MCP server in E2B sandbox
      // For now, use the filesystem server as a test
      // TODO: Upload our custom HTTP client MCP server
      const mcp = await startMcpSandbox({
        command: 'npx -y @modelcontextprotocol/server-filesystem /tmp',
        apiKey,
      });

      console.log('✓ MCP server started');
      console.log('  URL:', mcp.getUrl());

      // Get available tools
      // TODO: Implement getTools() - for now using mock tools
      const availableTools: McpTool[] = [
        {
          name: 'list_directory',
          description: 'List files in a directory',
          inputSchema: {
            type: 'object',
            properties: { path: { type: 'string' } },
            required: ['path'],
          },
        },
      ];
      console.log('✓ Tools loaded:', availableTools.length);

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
  };
}
