/**
 * APILab Backend Server
 * Handles E2B MCP sandbox creation (Node.js only operations)
 */

import { createServer } from 'node:http';
import Sandbox from 'e2b';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';

const PORT = process.env.PORT || 3001;

// In-memory cache for sandboxes (in production, use Redis/DB)
const sandboxCache = new Map<string, {
  sandbox: any;
  mcpClient: Client;
  mcpUrl: string;
  mcpToken: string;
}>();

/**
 * Create E2B sandbox with MCP gateway and connect MCP client
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

  // Connect MCP client (backend proxies all MCP operations)
  console.log('🔌 Connecting MCP client from backend...');
  const mcpClient = new Client({
    name: 'apilab-backend',
    version: '1.0.0'
  });

  const transport = new StreamableHTTPClientTransport(new URL(mcpUrl), {
    requestInit: {
      headers: {
        'Authorization': `Bearer ${mcpToken}`
      }
    }
  });

  await mcpClient.connect(transport);
  console.log('✅ MCP client connected!');

  // Cache everything
  const sandboxId = (sandbox as any).id || Date.now().toString();
  sandboxCache.set(sandboxId, {
    sandbox,
    mcpClient,
    mcpUrl,
    mcpToken
  });

  return {
    sandboxId,
    mcpUrl, // Still return for reference (but frontend won't use it directly)
    mcpToken, // Still return for reference
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
    const cached = sandboxCache.get(sandboxId || '');

    if (!cached) {
      sendJSON(res, { error: 'Sandbox not found' }, 404);
      return;
    }

    const isRunning = (await cached.sandbox.isRunning?.()) || false;

    sendJSON(res, {
      sandboxId,
      isRunning,
      url: cached.mcpUrl,
    });
    return;
  }

  // List MCP tools (PROXY)
  if (url.pathname.startsWith('/api/mcp/tools/') && req.method === 'GET') {
    const sandboxId = url.pathname.split('/').pop();
    const cached = sandboxCache.get(sandboxId || '');

    if (!cached) {
      sendJSON(res, { error: 'Sandbox not found' }, 404);
      return;
    }

    try {
      console.log('📋 Listing MCP tools for sandbox:', sandboxId);
      const toolsList = await cached.mcpClient.listTools();
      console.log(`✅ Found ${toolsList.tools.length} tools`);

      sendJSON(res, {
        tools: toolsList.tools,
        count: toolsList.tools.length
      });
    } catch (error: any) {
      console.error('❌ Failed to list tools:', error);
      sendJSON(res, {
        error: error.message || 'Failed to list MCP tools',
        details: error.stack
      }, 500);
    }
    return;
  }

  // Call MCP tool (PROXY)
  if (url.pathname.startsWith('/api/mcp/call/') && req.method === 'POST') {
    const sandboxId = url.pathname.split('/').pop();
    const cached = sandboxCache.get(sandboxId || '');

    if (!cached) {
      sendJSON(res, { error: 'Sandbox not found' }, 404);
      return;
    }

    try {
      const body = await parseBody(req);
      const { toolName, args } = body;

      if (!toolName) {
        sendJSON(res, { error: 'toolName is required' }, 400);
        return;
      }

      console.log(`🔧 Calling tool: ${toolName}`, args);
      const result = await cached.mcpClient.callTool({
        name: toolName,
        arguments: args || {}
      });
      console.log('✅ Tool call successful');

      sendJSON(res, {
        result: result.content,
        isError: result.isError || false
      });
    } catch (error: any) {
      console.error('❌ Failed to call tool:', error);
      sendJSON(res, {
        error: error.message || 'Failed to call MCP tool',
        details: error.stack
      }, 500);
    }
    return;
  }

  // 404
  sendJSON(res, { error: 'Not found' }, 404);
});

server.listen(PORT, () => {
  console.log('');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('🚀 APILab Backend Server (MCP Proxy Mode)');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('');
  console.log(`📍 Server:      http://localhost:${PORT}`);
  console.log(`🔍 Health:      http://localhost:${PORT}/health`);
  console.log('');
  console.log('🔌 MCP Endpoints:');
  console.log(`   POST /api/mcp/init                - Create sandbox`);
  console.log(`   GET  /api/mcp/tools/:sandboxId    - List tools`);
  console.log(`   POST /api/mcp/call/:sandboxId     - Call tool`);
  console.log(`   GET  /api/mcp/sandbox/:sandboxId  - Get info`);
  console.log('');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('');
});
