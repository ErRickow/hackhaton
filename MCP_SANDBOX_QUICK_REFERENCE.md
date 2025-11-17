# MCP Sandbox - Quick Reference Guide

## Installation & Basic Usage

### Install Package
```bash
npm install @netglade/mcp-sandbox
```

### Minimal Example
```typescript
import { startMcpSandbox } from '@netglade/mcp-sandbox';

const mcpSandbox = await startMcpSandbox({
  command: 'npx -y @modelcontextprotocol/server-brave-search',
  apiKey: 'e2b_YOUR_API_KEY',
  envs: {
    BRAVE_API_KEY: 'your-api-key'
  }
});

const url = mcpSandbox.getUrl();
// Use: https://<unique>.sandbox.e2b.dev/sse
```

---

## Architecture Overview

### Three-Layer Stack

```
Layer 1: Browser/Client
         ↓ (HTTP/SSE POST)
Layer 2: Supergateway (in E2B Sandbox)
         ↓ (Child Process stdio)
Layer 3: MCP Server
```

---

## Key Components

### startMcpSandbox(config)

**Parameters**:
```typescript
{
  command: string                    // Required: MCP server command
  apiKey: string                     // Required: E2B API key
  envs?: Record<string, string>      // Optional: Environment variables
  timeoutMs?: number                 // Optional: Default 10 min (600000ms)
}
```

**Returns**:
```typescript
Promise<McpSandbox>
```

### McpSandbox Class

**Properties**:
- `sandbox: Sandbox` - E2B Sandbox instance

**Methods**:
- `getUrl(): string` - Returns `https://<host>/sse` endpoint

---

## Command Examples

### Web Search MCP
```typescript
const mcp = await startMcpSandbox({
  command: 'npx -y @modelcontextprotocol/server-brave-search',
  apiKey: process.env.E2B_API_KEY,
  envs: {
    BRAVE_API_KEY: process.env.BRAVE_API_KEY
  }
});
```

### Filesystem MCP
```typescript
const mcp = await startMcpSandbox({
  command: 'npx -y @modelcontextprotocol/server-filesystem --root /tmp',
  apiKey: process.env.E2B_API_KEY
});
```

### Custom MCP Server
```typescript
const mcp = await startMcpSandbox({
  command: 'node /path/to/custom-server.js',
  apiKey: process.env.E2B_API_KEY
});
```

### With Long Timeout
```typescript
const mcp = await startMcpSandbox({
  command: 'npx -y @modelcontextprotocol/server-brave-search',
  apiKey: process.env.E2B_API_KEY,
  timeoutMs: 30 * 60 * 1000  // 30 minutes
});
```

---

## How It Works

### Request Flow

```
1. Client sends JSON-RPC request:
   POST /sse
   {
     "jsonrpc": "2.0",
     "method": "tools/call",
     "params": {...}
   }

2. Supergateway:
   - Parses HTTP request
   - Converts to JSON-RPC
   - Writes to MCP server stdin

3. MCP Server:
   - Processes request
   - Writes response to stdout

4. Supergateway:
   - Reads response
   - Converts to SSE format
   - Streams to client

5. Client receives:
   data: {"jsonrpc":"2.0",...}
```

---

## What Happens Inside E2B

1. **Container Creation**: Linux sandbox with Node.js/npm
2. **Supergateway Launch**: `npm -y supergateway --base-url <url> --port 3000 --cors --stdio "<command>"`
3. **MCP Server Spawn**: Runs as child process of supergateway
4. **HTTP Server**: Listens on port 3000 inside container
5. **E2B Tunneling**: Maps container port to HTTPS domain
6. **Auto Cleanup**: Destroys container after timeout

---

## Protocol Translation

### stdio → HTTP/SSE

```
Process IPC (Pipes)        HTTP/SSE (Network)
─────────────────          ──────────────────
stdin  ──write──→         POST /sse
stdout ←──read──          200 OK (SSE stream)
stderr (logging)          (error responses)
```

---

## Common Integration Patterns

### Pattern 1: With Claude API
```typescript
const mcpServer = await startMcpSandbox({
  command: 'npx -y @modelcontextprotocol/server-brave-search',
  apiKey: process.env.E2B_API_KEY
});

// Configure Claude to use MCP endpoint
const response = await client.messages.create({
  model: 'claude-3-5-sonnet-20241022',
  tools: [{
    type: 'mcp',
    uri: mcpServer.getUrl()
  }],
  messages: [...]
});
```

### Pattern 2: SSE Client
```typescript
import { SSEClientTransport } from '@modelcontextprotocol/sdk/client/sse.js';

const transport = new SSEClientTransport({
  url: mcpServer.getUrl()
});

const client = new Client(...);
await client.connect(transport);
```

### Pattern 3: Direct HTTP Calls
```typescript
const response = await fetch(mcpServer.getUrl(), {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    jsonrpc: '2.0',
    id: 1,
    method: 'tools/list'
  })
});
```

---

## Sandbox Lifecycle

```
Start
  │
  ├─ Create E2B Container (2-5s)
  │
  ├─ Launch Supergateway (1-2s)
  │
  ├─ Spawn MCP Server (1-3s)
  │
  ├─ MCP Server Ready
  │
  └─ Background execution
       │
       ├─ Listen for requests
       │
       ├─ Process tool calls
       │
       └─ Auto-cleanup after timeout
```

---

## Security Considerations

### What's Isolated
- Process namespace (separate PID space)
- Filesystem (ephemeral, isolated)
- Network (E2B-managed, ingress restricted)
- Environment (isolated variables)

### What's Not Isolated
- You must validate command input (injection risk)
- Environment variables passed unencrypted (E2B secures platform-level)
- Timeout cutoff (may interrupt long operations)

---

## Performance Expectations

### Cold Start
- **Total**: 4-11 seconds
  - E2B container: 2-5s
  - Supergateway: 1-2s
  - MCP server: 1-3s

### Warm Requests
- **Latency**: 100-2000ms
- **Depends on**: Tool type, network latency, MCP server performance

### Resource Usage
- **Memory**: 100-200MB idle, up to 1GB under load
- **CPU**: Shared vCPU
- **Storage**: Ephemeral, limited per container

---

## Build Artifacts

### Distribution Formats

```
dist/
├── esm/
│   ├── mcp-sandbox.es.js      (ES Module)
│   ├── mcp-sandbox.d.ts        (TypeScript definitions)
│   └── package.json            (type: "module")
│
└── cjs/
    ├── mcp-sandbox.umd.js      (CommonJS/UMD)
    └── package.json            (type: "commonjs")
```

### Module Resolution
```typescript
// ESM
import { startMcpSandbox } from '@netglade/mcp-sandbox';

// CommonJS
const { startMcpSandbox } = require('@netglade/mcp-sandbox');
```

---

## Troubleshooting

### "Sandbox not initialized"
- Ensure `startMcpSandbox()` completed successfully
- Check E2B API key is valid

### "CORS errors"
- Verify `--cors` flag is present in supergateway command
- Check flag order: `--cors` must come before `--stdio`

### "Command not found"
- Use `npx -y` prefix for npm packages
- Check command syntax: `'npx -y package-name [args]'`

### "Timeout errors"
- Increase `timeoutMs` parameter for long-running operations
- Default: 10 minutes (600000ms)

### "Environment variables not passed"
- Pass via `envs` parameter, not command string
- `envs: { KEY: 'value' }`

---

## API Surface

### Exported Names
```typescript
export { startMcpSandbox };
export type { McpSandbox };
```

### Zero External Dependencies
- Only peer dependency: `@e2b/code-interpreter@^1.1.0`
- No runtime npm packages bundled
- Pure JavaScript/TypeScript

---

## Configuration Options

### startMcpSandbox() Full Signature
```typescript
const mcpSandbox = await startMcpSandbox({
  // Required
  command: 'npx -y @modelcontextprotocol/server-brave-search',
  apiKey: 'e2b_...',
  
  // Optional
  envs: {
    'BRAVE_API_KEY': 'key...',
    'CUSTOM_VAR': 'value'
  },
  timeoutMs: 600000  // 10 minutes default
});
```

### Environment Variables Example
```typescript
envs: {
  'BRAVE_API_KEY': process.env.BRAVE_API_KEY,
  'DEBUG': 'true',
  'CUSTOM_PATH': '/tmp/data'
}
```

### Timeout Values
```typescript
// 30 seconds
timeoutMs: 30 * 1000

// 10 minutes (default)
timeoutMs: 10 * 60 * 1000

// 1 hour
timeoutMs: 60 * 60 * 1000
```

---

## Success Response Example

```typescript
const mcpSandbox = await startMcpSandbox({...});
// Returns McpSandbox instance

mcpSandbox.getUrl();
// Returns: "https://abc123def.sandbox.e2b.dev/sse"

mcpSandbox.sandbox;
// Access underlying E2B Sandbox for advanced usage
```

---

## Related Ecosystem

### MCP Servers (Ecosystem)
- `@modelcontextprotocol/server-brave-search` - Web search
- `@modelcontextprotocol/server-filesystem` - File operations
- Custom stdio-based MCP servers

### E2B Ecosystem
- `@e2b/code-interpreter` - Sandbox management SDK
- E2B Dashboard - API key management
- E2B Pricing - Usage metrics

### MCP Clients
- Claude API (with MCP support)
- SSE Client Transport SDK
- Custom HTTP clients

---

## Version History (Recent)

| Version | Key Change |
|---------|-----------|
| 0.0.11 | Current stable |
| 0.0.10 | Fixed argument order bug |
| 0.0.9  | Added CORS support |
| 0.0.7  | Type exports |
| 0.0.5  | Generic command support |

---

## Next Steps

1. **Get E2B API Key**: https://e2b.dev
2. **Install Package**: `npm install @netglade/mcp-sandbox`
3. **Choose MCP Server**: Browse ecosystem or create custom
4. **Implement**: 10 lines of code to get started
5. **Deploy**: Works in browser and Node.js environments

