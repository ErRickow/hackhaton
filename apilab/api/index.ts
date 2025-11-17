/**
 * APILab Backend Server
 * Handles E2B MCP sandbox creation (Node.js only operations)
 */

import { createServer } from 'node:http';
import Sandbox from 'e2b';

const PORT = process.env.PORT || 3001;

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

  // Try both beta and stable API methods
  let mcpUrl: string;
  let mcpToken: string;

  // Try beta methods first (betaGetMcpUrl, betaGetMcpToken)
  if (typeof (sandbox as any).betaGetMcpUrl === 'function') {
    mcpUrl = (sandbox as any).betaGetMcpUrl();
    mcpToken = await (sandbox as any).betaGetMcpToken();
  }
  // Fallback to stable methods (getMcpUrl, getMcpToken)
  else if (typeof (sandbox as any).getMcpUrl === 'function') {
    mcpUrl = (sandbox as any).getMcpUrl();
    mcpToken = await (sandbox as any).getMcpToken();
  }
  // Last resort: check if sandbox has mcp property directly
  else {
    console.error('⚠️ Available methods:', Object.keys(sandbox));
    throw new Error('E2B Sandbox does not have getMcpUrl or betaGetMcpUrl method. Check E2B SDK version.');
  }

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
 * Parse JSON body from request
 */
async function parseBody(req: any): Promise<any> {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', (chunk: any) => {
      body += chunk.toString();
    });
    req.on('end', () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch (e) {
        reject(e);
      }
    });
    req.on('error', reject);
  });
}

/**
 * Send JSON response with CORS
 */
function sendJSON(res: any, data: any, status = 200) {
  res.writeHead(status, {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  });
  res.end(JSON.stringify(data));
}

/**
 * Main HTTP server
 */
const server = createServer(async (req, res) => {
  const url = new URL(req.url!, `http://${req.headers.host}`);

  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    });
    res.end();
    return;
  }

  // Health check
  if (url.pathname === '/health') {
    sendJSON(res, { status: 'ok', timestamp: new Date().toISOString() });
    return;
  }

  // Create MCP sandbox
  if (url.pathname === '/api/mcp/init' && req.method === 'POST') {
    try {
      const body = await parseBody(req);
      const { apiKey, mcpServers } = body;

      if (!apiKey) {
        sendJSON(res, { error: 'E2B API key is required' }, 400);
        return;
      }

      // Default MCP servers if not specified
      const servers = mcpServers || {
        duckduckgo: {},
        arxiv: { storagePath: '/' },
      };

      const result = await createMcpSandbox(apiKey, servers);
      sendJSON(res, result);
    } catch (error: any) {
      console.error('❌ Failed to create sandbox:', error);
      sendJSON(
        res,
        {
          error: error.message || 'Failed to create MCP sandbox',
          details: error.stack,
        },
        500
      );
    }
    return;
  }

  // Get sandbox info
  if (url.pathname.startsWith('/api/mcp/sandbox/') && req.method === 'GET') {
    const sandboxId = url.pathname.split('/').pop();
    const sandbox = sandboxCache.get(sandboxId || '');

    if (!sandbox) {
      sendJSON(res, { error: 'Sandbox not found' }, 404);
      return;
    }

    const isRunning = (await sandbox.isRunning?.()) || false;

    sendJSON(res, {
      sandboxId,
      isRunning,
      url: (sandbox as any).betaGetMcpUrl?.(),
    });
    return;
  }

  // 404
  sendJSON(res, { error: 'Not found' }, 404);
});

server.listen(PORT, () => {
  console.log('');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('🚀 APILab Backend Server (Node.js)');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('');
  console.log(`📍 Server running at: http://localhost:${PORT}`);
  console.log(`🔍 Health check:      http://localhost:${PORT}/health`);
  console.log(`🌐 MCP Init endpoint: http://localhost:${PORT}/api/mcp/init`);
  console.log('');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('');
});
