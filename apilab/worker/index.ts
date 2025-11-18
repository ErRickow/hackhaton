/**
 * Cloudflare Worker untuk APILab Backend
 * Handles E2B MCP sandbox creation and proxies MCP tool operations
 *
 * Available Endpoints:
 * - POST /api/mcp/init - Create E2B sandbox with MCP gateway
 * - GET /api/mcp/sandbox/:id - Get sandbox info
 * - GET /api/mcp/tools/:id - List available MCP tools
 * - POST /api/mcp/call/:id - Call MCP tool
 */

import Sandbox from 'e2b';

// Type untuk environment variables
interface Env {
  // E2B_API_KEY bisa disimpan sebagai secret di Cloudflare Workers
}

// Helper function untuk CORS response
function corsResponse(body: any, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    },
  });
}

// In-memory cache with MCP client info (Workers KV lebih baik untuk production)
const sandboxCache = new Map<string, {
  sandbox: any;
  mcpUrl: string;
  mcpToken: string;
}>();

/**
 * Create E2B sandbox with MCP gateway
 * Using official E2B API: https://e2b.dev/docs/mcp
 */
async function createMcpSandbox(apiKey: string, mcpServers: Record<string, any>) {
  console.log('📦 Creating E2B sandbox with MCP gateway...');
  console.log('🌐 MCP Servers:', Object.keys(mcpServers).join(', '));

  // Official API: Use Sandbox.create() not Sandbox.betaCreate()
  const sandbox = await Sandbox.create({
    apiKey,
    mcp: mcpServers,
    timeoutMs: 600_000, // 10 minutes
  });

  // Official methods: getMcpUrl() and getMcpToken() (not beta methods)
  const mcpUrl = sandbox.getMcpUrl();
  const mcpToken = await sandbox.getMcpToken();

  console.log('✅ Sandbox created successfully!');
  console.log('🔗 MCP URL:', mcpUrl);

  // Cache the sandbox with MCP info
  const sandboxId = (sandbox as any).id || Date.now().toString();
  sandboxCache.set(sandboxId, {
    sandbox,
    mcpUrl,
    mcpToken,
  });

  return {
    sandboxId,
    mcpUrl,
    mcpToken,
  };
}

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);

    // Handle CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        },
      });
    }

    // Health check
    if (url.pathname === '/health') {
      return corsResponse({ status: 'ok', timestamp: new Date().toISOString() });
    }

    // Create MCP sandbox
    if (url.pathname === '/api/mcp/init' && request.method === 'POST') {
      try {
        const body: any = await request.json();
        const { apiKey, mcpServers } = body;

        if (!apiKey) {
          return corsResponse({ error: 'E2B API key is required' }, 400);
        }

        // Default MCP servers if not specified
        const servers = mcpServers || {
          duckduckgo: {},
          arxiv: { storagePath: '/' },
        };

        const result = await createMcpSandbox(apiKey, servers);
        return corsResponse(result);
      } catch (error: any) {
        console.error('❌ Failed to create sandbox:', error);
        return corsResponse(
          {
            error: error.message || 'Failed to create MCP sandbox',
            details: error.stack,
          },
          500
        );
      }
    }

    // Get sandbox info
    if (url.pathname.startsWith('/api/mcp/sandbox/') && request.method === 'GET') {
      const sandboxId = url.pathname.split('/').pop();
      const cached = sandboxCache.get(sandboxId || '');

      if (!cached) {
        return corsResponse({ error: 'Sandbox not found' }, 404);
      }

      const isRunning = (await cached.sandbox.isRunning?.()) || false;

      return corsResponse({
        sandboxId,
        isRunning,
        url: cached.mcpUrl,
      });
    }

    // List MCP tools (using direct HTTP fetch to MCP gateway)
    if (url.pathname.startsWith('/api/mcp/tools/') && request.method === 'GET') {
      const sandboxId = url.pathname.split('/').pop();
      const cached = sandboxCache.get(sandboxId || '');

      if (!cached) {
        return corsResponse({ error: 'Sandbox not found' }, 404);
      }

      try {
        console.log('📋 Listing MCP tools for sandbox:', sandboxId);

        // Fetch tools directly from MCP gateway using JSON-RPC over HTTP
        // Request JSON response only (not SSE)
        const mcpResponse = await fetch(cached.mcpUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${cached.mcpToken}`,
            'Accept': 'application/json',
          },
          body: JSON.stringify({
            jsonrpc: '2.0',
            id: Date.now(),
            method: 'tools/list',
            params: {}
          })
        });

        if (!mcpResponse.ok) {
          const errorText = await mcpResponse.text();
          throw new Error(`MCP gateway error: ${mcpResponse.status} ${mcpResponse.statusText} - ${errorText}`);
        }

        const contentType = mcpResponse.headers.get('content-type') || '';
        console.log('Response content-type:', contentType);

        // Handle SSE response if gateway sends it
        if (contentType.includes('text/event-stream')) {
          const text = await mcpResponse.text();
          console.log('SSE response:', text.substring(0, 200));

          // Parse SSE format: "data: {...}\n\n"
          const dataMatch = text.match(/data: (.*)\n/);
          if (dataMatch) {
            const mcpData = JSON.parse(dataMatch[1]);
            const tools = mcpData.result?.tools || [];
            console.log(`✅ Found ${tools.length} tools (via SSE)`);
            return corsResponse({ tools, count: tools.length });
          }
          throw new Error('Failed to parse SSE response');
        }

        // Handle regular JSON response
        const mcpData = await mcpResponse.json();
        const tools = mcpData.result?.tools || [];

        console.log(`✅ Found ${tools.length} tools`);

        return corsResponse({
          tools,
          count: tools.length
        });
      } catch (error: any) {
        console.error('❌ Failed to list tools:', error);
        return corsResponse({
          error: error.message || 'Failed to list MCP tools',
          details: error.stack
        }, 500);
      }
    }

    // Call MCP tool (using direct HTTP fetch to MCP gateway)
    if (url.pathname.startsWith('/api/mcp/call/') && request.method === 'POST') {
      const sandboxId = url.pathname.split('/').pop();
      const cached = sandboxCache.get(sandboxId || '');

      if (!cached) {
        return corsResponse({ error: 'Sandbox not found' }, 404);
      }

      try {
        const body: any = await request.json();
        const { toolName, args } = body;

        if (!toolName) {
          return corsResponse({ error: 'toolName is required' }, 400);
        }

        console.log(`🔧 Calling tool: ${toolName}`, args);

        // Call tool directly via MCP gateway using JSON-RPC over HTTP
        const mcpResponse = await fetch(cached.mcpUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${cached.mcpToken}`,
            'Accept': 'application/json',
          },
          body: JSON.stringify({
            jsonrpc: '2.0',
            id: Date.now(),
            method: 'tools/call',
            params: {
              name: toolName,
              arguments: args || {}
            }
          })
        });

        if (!mcpResponse.ok) {
          const errorText = await mcpResponse.text();
          throw new Error(`MCP gateway error: ${mcpResponse.status} ${mcpResponse.statusText} - ${errorText}`);
        }

        const contentType = mcpResponse.headers.get('content-type') || '';
        console.log('Response content-type:', contentType);

        let mcpData;
        // Handle SSE response if gateway sends it
        if (contentType.includes('text/event-stream')) {
          const text = await mcpResponse.text();
          console.log('SSE response:', text.substring(0, 200));

          // Parse SSE format: "data: {...}\n\n"
          const dataMatch = text.match(/data: (.*)\n/);
          if (dataMatch) {
            mcpData = JSON.parse(dataMatch[1]);
          } else {
            throw new Error('Failed to parse SSE response');
          }
        } else {
          // Handle regular JSON response
          mcpData = await mcpResponse.json();
        }

        const result = mcpData.result;
        console.log('✅ Tool call successful');

        return corsResponse({
          result: result?.content || result,
          isError: result?.isError || false
        });
      } catch (error: any) {
        console.error('❌ Failed to call tool:', error);
        return corsResponse({
          error: error.message || 'Failed to call MCP tool',
          details: error.stack
        }, 500);
      }
    }

    // 404
    return corsResponse({ error: 'Not found' }, 404);
  },
};
