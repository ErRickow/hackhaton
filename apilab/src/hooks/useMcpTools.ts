/**
 * useMcpTools Hook
 * Manages E2B MCP connection via backend API (Option 4: Full Browser SSE Client)
 */

import { useState, useEffect } from 'react';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import type { UseMcpToolsReturn } from '@/types';
import { z } from 'zod';

export function useMcpTools(): UseMcpToolsReturn {
  const [mcpServer, setMcpServer] = useState<any>(null);
  const [tools, setTools] = useState<any>({}); // Store AI SDK tools format
  const [isStarting, setIsStarting] = useState(false);
  const [isReady, setIsReady] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  /**
   * Wait for MCP gateway to be ready by polling the URL
   */
  async function waitForServerReady(url: string, token: string, maxAttempts = 10): Promise<boolean> {
    console.log(`🔍 Testing MCP gateway readiness at: ${url}`);
    console.log(`⏱️  Will try ${maxAttempts} times with 5 second delays`);

    for (let i = 0; i < maxAttempts; i++) {
      try {
        console.log(`\n📡 Attempt ${i + 1}/${maxAttempts}: Fetching ${url}...`);
        const response = await fetch(url, {
          method: 'GET',
          headers: {
            'Accept': 'application/json',
            'Authorization': `Bearer ${token}`
          }
        });

        console.log(`📥 Response status: ${response.status} ${response.statusText}`);

        if (response.ok) {
          console.log(`✅ MCP gateway ready!`);
          return true;
        }

        console.log(`⏳ Gateway not ready yet (attempt ${i + 1}/${maxAttempts})`);
      } catch (err) {
        console.log(`⏳ Gateway connection failed (attempt ${i + 1}/${maxAttempts}):`);
        console.error(err);
      }

      if (i < maxAttempts - 1) {
        console.log(`⌛ Waiting 5 seconds before next attempt...`);
        await new Promise(resolve => setTimeout(resolve, 5000));
      }
    }
    console.log(`\n❌ Gateway failed to become ready after ${maxAttempts} attempts`);
    return false;
  }

  /**
   * Convert MCP SDK tools to AI SDK format
   */
  function convertMcpToolsToAiSdk(mcpTools: any[]): Record<string, any> {
    const aiTools: Record<string, any> = {};

    for (const tool of mcpTools) {
      // Convert MCP tool schema to AI SDK tool format
      const parameters = tool.inputSchema ? convertJsonSchemaToZod(tool.inputSchema) : z.object({});

      aiTools[tool.name] = {
        description: tool.description || '',
        parameters,
        execute: async (args: any) => {
          // This will be called by AI SDK when tool is invoked
          // We return a placeholder - actual execution happens via MCP protocol
          return { success: true, args };
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
          if (value.description) {
            zodType = zodType.describe(value.description);
          }
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

  const startHttpClient = async () => {
    if (isStarting || isReady) return;

    setIsStarting(true);
    setError(null);

    try {
      console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.log('🚀 Starting E2B MCP via Backend API (Option 4)');
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
      console.log('⏱️  This may take 30-60 seconds for first boot...\n');

      // Get E2B API key and backend URL from localStorage
      const stored = window.localStorage.getItem('apilab_api_keys');
      const apiKeys = stored ? JSON.parse(stored) : {};
      const apiKey = apiKeys.e2b;
      const backendUrl = apiKeys.backendUrl || import.meta.env.VITE_API_URL || 'http://localhost:3001';

      console.log('🔑 Checking API keys...');
      console.log(`   E2B API key: ${apiKey ? '✅ Found (length: ' + apiKey.length + ')' : '❌ Not found'}`);
      console.log(`   Backend URL: ${backendUrl ? '✅ ' + backendUrl : '❌ Not configured'}`);

      if (!apiKey) {
        throw new Error('E2B API key not found. Please configure it in Settings.');
      }

      if (!backendUrl) {
        throw new Error('Backend URL not configured. Please configure it in Settings.');
      }

      // Call backend API to create MCP sandbox
      console.log('\n📡 Step 1: Calling backend API to create E2B sandbox...');
      console.log(`   API URL: ${backendUrl}/api/mcp/init`);

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
        console.error('❌ Backend API Error:', {
          status: initResponse.status,
          statusText: initResponse.statusText,
          error: errorData,
          url: `${backendUrl}/api/mcp/init`
        });
        throw new Error(`Backend API error (${initResponse.status}): ${errorData.error || initResponse.statusText}`);
      }

      const { sandboxId, mcpUrl, mcpToken } = await initResponse.json();

      console.log('✅ Backend API returned sandbox info!');
      console.log(`   Sandbox ID: ${sandboxId}`);
      console.log(`   MCP URL: ${mcpUrl}`);
      console.log(`   Token: ${mcpToken ? '✅ Obtained' : '❌ Missing'}\n`);

      // Wait for gateway to be ready
      console.log('📡 Step 2: Waiting for MCP gateway to be ready...');
      const isGatewayReady = await waitForServerReady(mcpUrl, mcpToken, 10);

      if (!isGatewayReady) {
        throw new Error('MCP gateway failed to start within timeout period');
      }

      // Create MCP client with authentication (BROWSER-COMPATIBLE!)
      console.log('\n🔌 Step 3: Creating MCP client (browser-compatible)...');
      const client = new Client({
        name: 'apilab-mcp-client',
        version: '1.0.0'
      });

      const transport = new StreamableHTTPClientTransport(new URL(mcpUrl), {
        requestInit: {
          headers: {
            'Authorization': `Bearer ${mcpToken}`
          }
        }
      });

      await client.connect(transport);
      console.log('✅ MCP client connected!\n');

      // List available tools
      console.log('🔧 Step 4: Fetching available tools from MCP gateway...');
      const toolsList = await client.listTools();

      console.log('\n✅ Tools loaded successfully!');
      console.log(`📊 Total tools: ${toolsList.tools.length}`);
      console.log('📋 Available tools:');
      toolsList.tools.forEach((tool: any) => {
        console.log(`   - ${tool.name}: ${tool.description || 'No description'}`);
      });

      // Convert MCP tools to AI SDK format
      console.log('\n🔄 Step 5: Converting tools to AI SDK format...');
      const aiSdkTools = convertMcpToolsToAiSdk(toolsList.tools);
      console.log(`✅ Converted ${Object.keys(aiSdkTools).length} tools to AI SDK format\n`);

      // Store everything
      setMcpServer({ sandboxId, mcpUrl, mcpToken, client });
      setTools(aiSdkTools);
      setIsReady(true);
      setIsStarting(false);

      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.log('✅ MCP Gateway Ready!');
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    } catch (err) {
      console.error('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.error('❌ MCP Gateway Initialization Failed');
      console.error('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
      console.error('Error details:', {
        name: err instanceof Error ? err.name : 'Unknown',
        message: err instanceof Error ? err.message : String(err),
        stack: err instanceof Error ? err.stack : undefined,
      });

      const error = err instanceof Error ? err : new Error(String(err));
      setError(error);
      setIsStarting(false);
      setIsReady(false);

      // Make sure error is visible
      console.error('🔴 ERROR OBJECT:', error);
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

      // Execute the tool
      const result = await tool.execute?.(args);
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
