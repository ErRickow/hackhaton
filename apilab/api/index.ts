/**
 * APILab Backend Server
 * Handles E2B MCP sandbox creation (Node.js only operations)
 */

import Sandbox from 'e2b';

const PORT = process.env.PORT || 3001;

// Simple CORS headers
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

// In-memory cache for sandboxes (in production, use Redis/DB)
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

/**
 * Main HTTP server
 */
const server = Bun.serve({
  port: PORT,
  async fetch(req) {
    const url = new URL(req.url);

    // Handle CORS preflight
    if (req.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }

    // Health check
    if (url.pathname === '/health') {
      return Response.json(
        { status: 'ok', timestamp: new Date().toISOString() },
        { headers: corsHeaders }
      );
    }

    // Create MCP sandbox
    if (url.pathname === '/api/mcp/init' && req.method === 'POST') {
      try {
        const body = await req.json();
        const { apiKey, mcpServers } = body;

        if (!apiKey) {
          return Response.json(
            { error: 'E2B API key is required' },
            { status: 400, headers: corsHeaders }
          );
        }

        // Default MCP servers if not specified
        const servers = mcpServers || {
          duckduckgo: {},
          arxiv: { storagePath: '/' },
        };

        const result = await createMcpSandbox(apiKey, servers);

        return Response.json(result, { headers: corsHeaders });
      } catch (error: any) {
        console.error('❌ Failed to create sandbox:', error);
        return Response.json(
          {
            error: error.message || 'Failed to create MCP sandbox',
            details: error.stack,
          },
          { status: 500, headers: corsHeaders }
        );
      }
    }

    // Get sandbox info
    if (url.pathname.startsWith('/api/mcp/sandbox/') && req.method === 'GET') {
      const sandboxId = url.pathname.split('/').pop();
      const sandbox = sandboxCache.get(sandboxId || '');

      if (!sandbox) {
        return Response.json(
          { error: 'Sandbox not found' },
          { status: 404, headers: corsHeaders }
        );
      }

      const isRunning = await sandbox.isRunning?.() || false;

      return Response.json(
        {
          sandboxId,
          isRunning,
          url: (sandbox as any).betaGetMcpUrl?.(),
        },
        { headers: corsHeaders }
      );
    }

    // 404
    return Response.json(
      { error: 'Not found' },
      { status: 404, headers: corsHeaders }
    );
  },
});

console.log('');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('🚀 APILab Backend Server');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('');
console.log(`📍 Server running at: http://localhost:${PORT}`);
console.log(`🔍 Health check:      http://localhost:${PORT}/health`);
console.log(`🌐 MCP Init endpoint: http://localhost:${PORT}/api/mcp/init`);
console.log('');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('');
