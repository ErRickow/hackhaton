# MCP Sandbox - Executive Summary

## What Is It?

**mcp-sandbox** is a lightweight npm package that runs Model Context Protocol (MCP) servers in isolated cloud sandboxes using E2B infrastructure.

**Key Innovation**: Bridges the protocol translation gap between:
- **Stdio** (process IPC used by MCP servers)
- **HTTP/SSE** (network protocol usable from browsers)

---

## Core Problem It Solves

### The Challenge

MCP servers traditionally run locally and communicate via stdio (input/output streams). But modern AI applications need:
1. Cloud-based execution (no local dependencies)
2. Browser accessibility (HTTP/S endpoints)
3. Sandboxed isolation (safety for untrusted code)
4. Automatic cleanup (cost efficiency)

**Solution**: mcp-sandbox bridges all these requirements in ~60 lines of code.

---

## How It Works (Simple Version)

```typescript
// 1. Start a sandbox with an MCP server
const mcp = await startMcpSandbox({
  command: 'npx -y @modelcontextprotocol/server-brave-search',
  apiKey: 'e2b_YOUR_KEY'
});

// 2. Get the URL
const url = mcp.getUrl();
// Result: https://abc123.sandbox.e2b.dev/sse

// 3. Connect your AI app
const client = new MCPClient(url);
await client.listTools();
```

---

## Architecture (Three-Layer Stack)

```
Layer 1: Your Application (Browser or Node.js)
         ↓ HTTP POST requests
Layer 2: Supergateway (runs in E2B sandbox)
         Converts HTTP ↔ stdio
         ↓ spawns as child process
Layer 3: MCP Server (e.g., web search, file ops)
         Provides tools to your AI
```

---

## The Three Magic Components

### 1. E2B (Infrastructure)
- Creates ephemeral Linux containers
- Provides HTTPS domains with TLS
- Auto-cleanup after timeout
- Costs pennies per minute

### 2. Supergateway (Protocol Bridge)
- Converts stdio protocol to HTTP/SSE
- Runs MCP server as child process
- Enables browser clients (CORS support)
- Open source: github.com/supercorp-ai/supergateway

### 3. mcp-sandbox (Glue)
- 60 lines of TypeScript
- Orchestrates E2B + Supergateway
- Type-safe wrapper
- Simple API

---

## What Gets Deployed

When you call `startMcpSandbox()`:

```
E2B Container (ephemeral, auto-cleanup)
├── Supergateway (HTTP server on port 3000)
│   └── Spawns: MCP Server
│       └── Provides: Tools (search, files, custom)
└── E2B Tunnel: Maps port 3000 → HTTPS domain
    └── Result: https://xyz.sandbox.e2b.dev/sse
```

---

## Key Technical Insights

### 1. Protocol Translation

| Layer | Protocol | Example |
|-------|----------|---------|
| Browser → Supergateway | HTTP/SSE | `POST /sse { jsonrpc... }` |
| Supergateway ↔ MCP | Stdio | `stdin: JSON`, `stdout: JSON` |

### 2. Why This Works

- **Minimal code**: 60 lines wrapping mature libraries
- **No bundling**: Uses peer dependency only
- **Type-safe**: Full TypeScript with strict mode
- **Zero runtime deps**: No npm packages to maintain
- **Ephemeral**: Auto-cleanup, no infrastructure debt

### 3. Critical Innovation: Command Execution

```bash
npx -y supergateway \
  --base-url https://sandbox.e2b.dev \
  --port 3000 \
  --cors \           # Critical for browsers
  --stdio \          # Indicates MCP server uses stdio
  "npx -y @modelcontextprotocol/server-brave-search"
```

**Key insight**: Single command line that:
1. Downloads supergateway
2. Downloads MCP server
3. Starts HTTP server
4. Connects everything together

---

## Performance Profile

### Cold Start
- E2B container: 2-5s
- Supergateway: 1-2s
- MCP server: 1-3s
- **Total**: 4-11 seconds

### Warm Requests
- Latency: 100-2000ms (depending on tool)
- Network: 100-500ms round-trip
- Tool execution: Varies (web search: 1-5s, local ops: <100ms)

### Resource Usage
- Memory: 100-200MB idle, up to 1GB under load
- CPU: Shared vCPU
- Storage: Ephemeral (deleted after timeout)
- **Cost**: ~$0.001 per minute of sandbox time (E2B pricing)

---

## Supported MCP Servers

### Official (from Anthropic)
- `@modelcontextprotocol/server-brave-search` - Web search
- `@modelcontextprotocol/server-filesystem` - File operations
- More being developed

### Custom Servers
- Any stdio-based MCP server
- Node.js, Python, Rust, Go, etc.
- Just pass the command: `node my-server.js`

---

## Integration Patterns

### Pattern 1: With Claude AI
```typescript
const mcp = await startMcpSandbox({
  command: 'npx -y @modelcontextprotocol/server-brave-search',
  apiKey: process.env.E2B_API_KEY
});

// Claude can now use the tools
const response = await client.messages.create({
  model: 'claude-3-5-sonnet-20241022',
  tools: [{ type: 'mcp', uri: mcp.getUrl() }],
  messages: [...]
});
```

### Pattern 2: Browser-Based (Next.js, Vite)
```typescript
// API route
export async function POST(req) {
  const mcp = await startMcpSandbox({...});
  return Response.json({ url: mcp.getUrl() });
}

// Frontend
const response = await fetch('/api/mcp', { method: 'POST' });
const { url } = await response.json();
const client = new MCPClient(url);
```

### Pattern 3: Custom HTTP Client
```typescript
const response = await fetch(mcp.getUrl(), {
  method: 'POST',
  body: JSON.stringify({
    jsonrpc: '2.0',
    method: 'tools/call',
    params: { name: 'web_search', arguments: { query: '...' } }
  })
});
```

---

## Security Model

### What's Protected
- **Process isolation**: MCP server in separate container
- **Filesystem isolation**: Ephemeral, deleted after timeout
- **Network isolation**: E2B-managed firewall
- **Automatic cleanup**: No persistent resources
- **TLS encryption**: HTTPS with valid certificates

### What You Need to Protect
- **Command input**: Never trust user input in `command` parameter
- **API keys**: Keep E2B API key secret (but pass to function)
- **Environment variables**: Only pass sensitive data you trust

---

## Why It Won the Hackathon

**Technical Excellence**:
- Elegant solution to hard problem
- Minimal code, maximum functionality
- Proper TypeScript and build systems
- Zero runtime dependencies

**Practical Innovation**:
- Solves real problem (MCP in cloud)
- Works in browsers (game-changer)
- Easy to integrate (one function call)
- Cost-effective (pay-per-use)

**Architecture**:
- Correct layering of concerns
- Proper delegation to mature libraries
- Type-safe API
- Extensible design

---

## Current State

**Version**: 0.0.11 (stable)
**NPM Package**: `@netglade/mcp-sandbox`
**License**: MIT
**Repository**: github.com/netglade/mcp-sandbox

**Recent Evolution**:
- v0.0.9: Added CORS support (critical for browsers)
- v0.0.10: Fixed argument order bug (flags matter!)
- v0.0.11: Current stable version

---

## Future Potential

### Short Term
- Pre-configured MCP server templates
- Better error messages
- Logging/monitoring support

### Medium Term
- Multi-server orchestration (multiple MCP servers per sandbox)
- Persistent storage attachments
- Rate limiting and quotas
- Custom E2B template support

### Long Term
- MCP server marketplace/registry
- Optimized cold-start performance
- Custom networking features
- Advanced monitoring/analytics

---

## Comparison with Alternatives

| Feature | mcp-sandbox | Local MCP | Cloud Deploy |
|---------|------------|----------|--------------|
| **Setup** | 1 function call | Install locally | Docker + deploy |
| **Security** | High (sandboxed) | Manual | Manual |
| **Scalability** | Auto (E2B) | Manual scaling | Auto (cloud) |
| **Browser Ready** | Yes (SSE) | No | Yes (API) |
| **Cost** | Pennies/min | Free | Infrastructure $ |
| **Cold Start** | 5-10s | Instant | 1-2s |
| **Maintenance** | Zero (E2B) | User responsibility | Moderate |

---

## Key Learnings

### For MCP Integration
1. **Protocol translation is the hard part** - Supergateway solves it
2. **Stdio is the MCP default** - Most servers use it
3. **SSE is browser-compatible** - But needs CORS support
4. **Ephemeral is best** - Auto-cleanup prevents infrastructure debt

### For TypeScript Projects
1. **Thin wrappers are powerful** - 60 lines can enable a use case
2. **Type exports matter** - Consumers need `export type { T }`
3. **Dual ESM/CJS support** - Use build script approach
4. **Peer dependencies work** - For optional/flexible integrations

### For Cloud Architecture
1. **Unique domains per request** - E2B's clever networking
2. **Background execution is critical** - `background: true` is key
3. **TLS management is important** - E2B handles certificates
4. **Resource cleanup is automatic** - No manual intervention needed

---

## Getting Started

### Prerequisites
1. E2B account: https://e2b.dev (free tier available)
2. E2B API key from dashboard
3. npm/node environment

### Installation
```bash
npm install @netglade/mcp-sandbox
npm install @e2b/code-interpreter
```

### Quick Start
```typescript
import { startMcpSandbox } from '@netglade/mcp-sandbox';

const mcp = await startMcpSandbox({
  command: 'npx -y @modelcontextprotocol/server-brave-search',
  apiKey: process.env.E2B_API_KEY,
  envs: {
    BRAVE_API_KEY: process.env.BRAVE_API_KEY
  }
});

const url = mcp.getUrl();
// Use: https://xxx.sandbox.e2b.dev/sse
```

---

## Resources

**Official Links**:
- Repository: https://github.com/netglade/mcp-sandbox
- NPM: https://www.npmjs.com/package/@netglade/mcp-sandbox
- Live Demo: https://netglade.github.io/mcp-chat/
- Demo Code: https://github.com/netglade/mcp-chat
- Blog Post: https://www.netglade.cz/en/blog/bringing-mcps-to-the-cloud-how-we-won-the-e2b-hackathon

**Related Projects**:
- E2B: https://e2b.dev
- Supergateway: https://github.com/supercorp-ai/supergateway
- MCP Spec: https://spec.modelcontextprotocol.io/

---

## Conclusion

**mcp-sandbox** is a masterclass in elegant engineering:

1. **Problem**: How to run MCP servers in the cloud and make them accessible from browsers?

2. **Solution**: Thin wrapper orchestrating:
   - E2B (infrastructure)
   - Supergateway (protocol translation)
   - Standard MCP servers

3. **Result**: 
   - One function call
   - Seconds to deploy
   - Global accessibility
   - Perfect for AI applications

The package demonstrates that sometimes the best solution isn't the most complex—it's the one that correctly layers concerns and delegates to mature libraries. By focusing on orchestration rather than implementation, the team created something that's both powerful and maintainable.

**Perfect for**: AI assistants, tool-augmented LLMs, browser-based AI applications, rapid prototyping of MCP integrations.

