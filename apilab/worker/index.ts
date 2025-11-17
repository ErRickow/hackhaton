/**
 * Cloudflare Worker untuk APILab Backend
 * Handles E2B MCP sandbox creation
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

// In-memory cache (Workers KV lebih baik untuk production)
const sandboxCache = new Map<string, any>();

/**
 * Create E2B sandbox with MCP gateway
 */
async function createMcpSandbox(apiKey: string, mcpServers: Record<string, any>) {
  console.log('📦 Creating E2B sandbox with MCP gateway...');
  console.log('🌐 MCP Servers:', Object.keys(mcpServers).join(', '));

  const sandbox = await Sandbox.betaCreate({
    apiKey,
    mcp: mcpServers,
    timeoutMs: 600_000, // 10 minutes
  });

  const mcpUrl = (sandbox as any).betaGetMcpUrl();
  const mcpToken = await (sandbox as any).betaGetMcpToken();

  console.log('✅ Sandbox created successfully!');
  console.log('🔗 MCP URL:', mcpUrl);

  // Cache the sandbox
  const sandboxId = (sandbox as any).id || Date.now().toString();
  sandboxCache.set(sandboxId, sandbox);

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
      const sandbox = sandboxCache.get(sandboxId || '');

      if (!sandbox) {
        return corsResponse({ error: 'Sandbox not found' }, 404);
      }

      const isRunning = (await sandbox.isRunning?.()) || false;

      return corsResponse({
        sandboxId,
        isRunning,
        url: (sandbox as any).betaGetMcpUrl?.(),
      });
    }

    // 404
    return corsResponse({ error: 'Not found' }, 404);
  },
};
