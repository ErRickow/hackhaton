/**
 * useMcpTools Hook
 * Manages E2B MCP connection via BACKEND PROXY (no direct E2B connection)
 */

import { useState, useEffect } from 'react';
import type { UseMcpToolsReturn } from '@/types';
import { z } from 'zod';

export function useMcpTools(): UseMcpToolsReturn {
  const [mcpServer, setMcpServer] = useState<any>(null);
  const [tools, setTools] = useState<any>({}); // Store AI SDK tools format
  const [isStarting, setIsStarting] = useState(false);
  const [isReady, setIsReady] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  /**
   * Convert MCP SDK tools to AI SDK format
   */
  function convertMcpToolsToAiSdk(mcpTools: any[], callToolFn: (name: string, args: any) => Promise<any>): Record<string, any> {
    const aiTools: Record<string, any> = {};

    for (const tool of mcpTools) {
      // Convert MCP tool schema to AI SDK tool format
      const parameters = tool.inputSchema ? convertJsonSchemaToZod(tool.inputSchema) : z.object({});

      aiTools[tool.name] = {
        description: tool.description || '',
        parameters,
        execute: async (args: any) => {
          // ✅ Actually call the MCP tool via backend
          console.log(`🔧 Executing MCP tool: ${tool.name}`, args);
          try {
            const result = await callToolFn(tool.name, args);
            console.log(`✅ Tool ${tool.name} executed successfully`);
            return result;
          } catch (error) {
            console.error(`❌ Tool ${tool.name} execution failed:`, error);
            throw error;
          }
        }
      };
    }

    return aiTools;
  }

  /**
   * Convert JSON Schema to Zod schema (simplified)
   */
  function convertJsonSchemaToZod(schema: any): z.ZodType<any> {
    if (!schema || !schema.properties) {
      return z.object({});
    }

    const shape: Record<string, z.ZodType<any>> = {};

    for (const [key, value] of Object.entries(schema.properties as Record<string, any>)) {
      const isRequired = schema.required?.includes(key) ?? false;

      let zodType: z.ZodType<any>;

      switch (value.type) {
        case 'string':
          zodType = z.string();
          break;
        case 'number':
          zodType = z.number();
          break;
        case 'boolean':
          zodType = z.boolean();
          break;
        case 'array':
          zodType = z.array(z.any());
          break;
        case 'object':
          zodType = z.object({});
          break;
        default:
          zodType = z.any();
      }

      shape[key] = isRequired ? zodType : zodType.optional();
    }

    return z.object(shape);
  }

  /**
   * Start MCP connection via backend proxy
   * Backend handles all E2B communication
   */
  const startHttpClient = async () => {
    setIsStarting(true);
    setError(null);
    setIsReady(false);

    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('🚀 Starting MCP Connection via Backend Proxy');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    try {
      // Get config from localStorage (stored as single object)
      const apiKeysJson = localStorage.getItem('apilab_api_keys');
      const apiKeys = apiKeysJson ? JSON.parse(apiKeysJson) : {};

      const apiKey = apiKeys.e2b;
      const backendUrl = apiKeys.backendUrl;

      if (!apiKey) {
        throw new Error('E2B API key not found. Please configure it in Settings.');
      }

      if (!backendUrl) {
        throw new Error('Backend URL not configured. Please configure it in Settings.');
      }

      // Step 1: Call backend to create E2B sandbox
      console.log('📡 Step 1: Creating E2B sandbox via backend...');
      console.log(`   Backend: ${backendUrl}/api/mcp/init`);

      const initResponse = await fetch(`${backendUrl}/api/mcp/init`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          apiKey,
          mcpServers: {
            duckduckgo: {},
            arxiv: { storagePath: '/' },
          }
        })
      });

      if (!initResponse.ok) {
        const errorText = await initResponse.text();
        let errorData;
        try {
          errorData = JSON.parse(errorText);
        } catch {
          errorData = { error: errorText };
        }

        const error = new Error(`Backend API error (${initResponse.status}): ${errorData.error || initResponse.statusText}`) as any;
        error.status = initResponse.status;
        error.statusText = initResponse.statusText;
        error.url = `${backendUrl}/api/mcp/init`;
        error.responseBody = errorData;
        error.rawResponse = errorText;

        console.error('❌ Backend API Error:', error);
        throw error;
      }

      const { sandboxId } = await initResponse.json();

      console.log('✅ Backend created sandbox!');
      console.log(`   Sandbox ID: ${sandboxId}\n`);

      // Step 2: Fetch tools from backend proxy (backend handles MCP connection)
      console.log('🔧 Step 2: Fetching tools via backend proxy...');
      console.log(`   Backend: ${backendUrl}/api/mcp/tools/${sandboxId}`);

      const toolsResponse = await fetch(`${backendUrl}/api/mcp/tools/${sandboxId}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        }
      });

      if (!toolsResponse.ok) {
        const errorText = await toolsResponse.text();
        let errorData;
        try {
          errorData = JSON.parse(errorText);
        } catch {
          errorData = { error: errorText };
        }

        const error = new Error(`Backend tools error (${toolsResponse.status}): ${errorData.error || toolsResponse.statusText}`) as any;
        error.status = toolsResponse.status;
        error.statusText = toolsResponse.statusText;
        error.url = `${backendUrl}/api/mcp/tools/${sandboxId}`;
        error.responseBody = errorData;
        error.rawResponse = errorText;

        console.error('❌ Backend Tools Error:', error);
        throw error;
      }

      const { tools: mcpTools } = await toolsResponse.json();

      console.log('\n✅ Tools loaded successfully!');
      console.log(`📊 Total tools: ${mcpTools.length}`);
      console.log('📋 Available tools:');
      mcpTools.forEach((tool: any) => {
        console.log(`   - ${tool.name}: ${tool.description || 'No description'}`);
      });

      // Convert MCP tools to AI SDK format
      console.log('\n🔄 Step 3: Converting tools to AI SDK format...');
      const aiSdkTools = convertMcpToolsToAiSdk(mcpTools, callTool);
      console.log(`✅ Converted ${Object.keys(aiSdkTools).length} tools to AI SDK format\n`);

      // Store everything (no MCP client - backend handles it)
      setMcpServer({ sandboxId, backendUrl });
      setTools(aiSdkTools);
      setIsReady(true);
      setIsStarting(false);

      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.log('✅ MCP Ready via Backend Proxy!');
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    } catch (err) {
      console.error('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.error('❌ MCP Initialization Failed');
      console.error('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
      console.error('Error details:', err);

      // Preserve all error properties for debugging
      let error: any;
      if (err instanceof Error) {
        error = err;
      } else {
        error = new Error(String(err));
        error.originalError = err;
      }

      setError(error);
      setIsStarting(false);
      setIsReady(false);

      console.error('🔴 FULL ERROR OBJECT:', error);
    }
  };

  /**
   * Call MCP tool via backend proxy
   */
  const callTool = async (toolName: string, args: Record<string, any>) => {
    if (!mcpServer || !mcpServer.sandboxId) {
      throw new Error('MCP server not initialized');
    }

    if (!tools || Object.keys(tools).length === 0) {
      throw new Error('MCP tools not initialized');
    }

    try {
      console.log(`🔧 Calling MCP tool via backend: ${toolName}`, args);

      const { sandboxId, backendUrl } = mcpServer;

      // Call backend proxy to execute tool
      const response = await fetch(`${backendUrl}/api/mcp/call/${sandboxId}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          toolName,
          args
        })
      });

      if (!response.ok) {
        const errorText = await response.text();
        let errorData;
        try {
          errorData = JSON.parse(errorText);
        } catch {
          errorData = { error: errorText };
        }

        const error = new Error(`Backend tool call error (${response.status}): ${errorData.error || response.statusText}`) as any;
        error.status = response.status;
        error.statusText = response.statusText;
        error.url = `${backendUrl}/api/mcp/call/${sandboxId}`;
        error.toolName = toolName;
        error.args = args;
        error.responseBody = errorData;
        error.rawResponse = errorText;

        console.error('❌ Backend Tool Call Error:', error);
        throw error;
      }

      const result = await response.json();
      console.log('✓ MCP tool result:', result);

      return result;
    } catch (error) {
      console.error('❌ MCP tool call failed:', error);
      throw error;
    }
  };

  /**
   * Restart MCP connection (for config changes)
   */
  const restartConnection = async () => {
    console.log('🔄 Restarting MCP connection...');

    // Reset state
    setIsReady(false);
    setIsStarting(false);
    setError(null);
    setTools({});
    setMcpServer(null);

    // Wait a bit before restarting
    await new Promise(resolve => setTimeout(resolve, 500));

    // Start again
    await startHttpClient();
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
    restartConnection,
    mcpServer,
    callTool,
  };
}
