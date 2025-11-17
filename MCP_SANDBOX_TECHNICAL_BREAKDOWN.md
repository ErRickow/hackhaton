# MCP Sandbox - Detailed Technical Breakdown

**Repository**: https://github.com/netglade/mcp-sandbox  
**Type**: NPM Package (TypeScript/JavaScript)  
**Current Version**: 0.0.11  
**Winner**: E2B Agents and AI Tools Hackathon  
**License**: MIT

---

## 1. PROJECT OVERVIEW

The mcp-sandbox package is a lightweight TypeScript wrapper that enables running Model Context Protocol (MCP) servers directly in the browser using E2B's secure sandbox environment. It bridges stdio-based MCP servers to SSE (Server-Sent Events) using the supergateway tool.

**Key Value Proposition**:
- Run MCP servers in isolated cloud environments (no local setup required)
- Access real-world tools and data sources from browser-based AI assistants
- Secure, stateful execution with automatic cleanup
- Compatible with any stdio-based MCP server

---

## 2. PROJECT STRUCTURE

```
mcp-sandbox/
├── src/
│   ├── index.ts                    # Main export file
│   └── mcpSandbox.ts              # Core implementation
├── scripts/
│   └── build.js                   # Custom build script (dual bundle)
├── package.json                   # NPM package configuration
├── vite.config.ts                 # Vite build configuration
├── tsconfig.base.json             # TypeScript configuration
├── tsconfig.json                  # ESM TypeScript config
├── tsconfig.cjs.json              # CommonJS TypeScript config
├── tsconfig.node.json             # Node.js config for vite
├── .github/workflows/
│   └── node.js.yml                # CI/CD pipeline
└── README.md                      # Documentation
```

### Source Code Organization

**src/index.ts** (1 line)
```typescript
export * from "./mcpSandbox";
```
- Simple re-export pattern for clean API surface

**src/mcpSandbox.ts** (59 lines total)
- Core implementation with minimal dependencies
- Two main exports:
  1. `startMcpSandbox()` - Async factory function
  2. `McpSandbox` - Class wrapper for sandbox instance

---

## 3. CORE ARCHITECTURE

### 3.1 High-Level Flow Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                     Browser/Client                           │
│  (Claude Code, AI Assistant, or Custom Application)          │
└────────────────────────────┬────────────────────────────────┘
                             │
                 HTTP/SSE Calls (Port 3000)
                             │
                             ▼
┌─────────────────────────────────────────────────────────────┐
│                  E2B Sandbox (Ephemeral)                     │
│                                                               │
│  ┌─────────────────────────────────────────────────────┐    │
│  │  Supergateway (Port 3000)                           │    │
│  │  - Converts stdio to SSE/HTTP                       │    │
│  │  - Handles CORS                                     │    │
│  │  - Acts as HTTP proxy                              │    │
│  └────────────────────┬────────────────────────────────┘    │
│                       │                                       │
│            Spawns as Child Process                           │
│                       │                                       │
│  ┌────────────────────▼────────────────────────────────┐    │
│  │  MCP Server (stdio-based)                           │    │
│  │  Examples:                                          │    │
│  │  - @modelcontextprotocol/server-brave-search       │    │
│  │  - @modelcontextprotocol/server-filesystem         │    │
│  │  - Custom MCP servers                              │    │
│  └─────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────┘
```

### 3.2 Execution Flow

1. **Initialization Phase**
   - Client calls `startMcpSandbox({ command, apiKey, envs?, timeoutMs? })`
   - E2B SDK creates an ephemeral sandbox environment

2. **Sandbox Setup**
   - E2B allocates container with Node.js runtime
   - `sandbox.getHost(3000)` generates secure HTTPS URL
   - Returns format: `https://<unique-id>.sandbox.e2b.dev`

3. **MCP Server Launch**
   - Executes: `npx -y supergateway --base-url <URL> --port 3000 --cors --stdio "<command>"`
   - Runs in background (non-blocking)
   - Command example: `"npx -y @modelcontextprotocol/server-brave-search"`

4. **Service Activation**
   - Supergateway listens on port 3000
   - Spawns MCP server as child process
   - Ready to accept HTTP/SSE connections at `https://<host>/sse`

5. **Return and Usage**
   - Function returns `McpSandbox` instance
   - Client can call `mcpSandbox.getUrl()` to get SSE endpoint
   - Connection stays alive until timeout or manual cleanup

---

## 4. CORE IMPLEMENTATION DETAILS

### 4.1 startMcpSandbox() Function

```typescript
export const startMcpSandbox = async ({
  command,
  apiKey,
  envs = {},
  timeoutMs = 1000 * 60 * 10,
}: {
  command: string           // MCP server command to execute
  apiKey: string           // E2B API key for authentication
  envs?: Record<string, string>  // Additional environment variables
  timeoutMs?: number       // Sandbox lifetime (default: 10 minutes)
}) => {
  // Step 1: Create E2B Sandbox
  const sandbox = await Sandbox.create("base", {
    timeoutMs,
    apiKey,
  });

  // Step 2: Generate secure HTTPS URL
  const host = sandbox.getHost(3000);
  const url = `https://${host}`;

  // Step 3: Launch supergateway with MCP server
  await sandbox.commands.run(
      `npx -y supergateway --base-url ${url} --port 3000 --cors --stdio "${command}"`,
      {
        envs,                    // Pass custom environment variables
        background: true,        // Non-blocking execution
        onStdout: (data: string) => {
          console.log(data);     // Stream stdout logs
        },
        onStderr: (data: string) => {
          console.log(data);     // Stream stderr logs
        }
      }
  );

  console.log("MCP server started at:", url + "/sse");
  return new McpSandbox(sandbox);
}
```

**Key Technical Points**:

1. **Sandbox Creation**
   - `Sandbox.create("base", ...)` creates minimal Node.js environment
   - "base" template includes npm and Node.js preinstalled
   - API key authenticates with E2B infrastructure

2. **Host Generation**
   - `sandbox.getHost(3000)` generates unique, routable HTTPS domain
   - Automatically configured with TLS certificates
   - Each sandbox gets isolated domain (security through obscurity + E2B network isolation)

3. **Command Execution**
   - Uses `npx -y` for zero-install execution
   - `--base-url <url>` tells supergateway the external HTTPS endpoint
   - `--port 3000` specifies container-internal port
   - `--cors` enables Cross-Origin Resource Sharing for browser clients
   - `--stdio` indicates MCP server uses stdio transport
   - Command in quotes allows parameters with spaces

4. **Background Execution**
   - `background: true` prevents blocking the client
   - stdout/stderr logging for debugging and monitoring
   - Sandbox cleanup happens automatically after `timeoutMs`

### 4.2 McpSandbox Class

```typescript
class McpSandbox {
  public sandbox: Sandbox;

  constructor(sandbox: Sandbox) {
    this.sandbox = sandbox;
  }

  getUrl(): string {
    if (!this.sandbox) {
      throw new Error("Sandbox not initialized");
    }
    const host = this.sandbox.getHost(3000);
    return `https://${host}/sse`;
  }
}

export type { McpSandbox };
```

**Class Responsibilities**:
- Wraps E2B Sandbox instance
- Provides type-safe access to sandbox
- `getUrl()` returns SSE endpoint URL
- Exports TypeScript type for consumer code

---

## 5. HOW STDIO IS CONVERTED TO SSE

### 5.1 The Role of Supergateway

**Supergateway** is the critical bridge component. It:

1. **Wraps stdio MCP Server**
   - Spawns MCP server as child process
   - Pipes stdin/stdout/stderr

2. **Converts Protocol**
   - Reads MCP JSON-RPC messages from stdout
   - Receives client requests via HTTP
   - Converts to JSON-RPC and writes to stdin
   - HTTP responses sent back as JSON

3. **Implements SSE Support**
   - Endpoint: `/sse`
   - Uses Server-Sent Events for streaming responses
   - Enables long-polling compatible with browsers

4. **Network Translation**
   - Stdio = local IPC (operating system pipes)
   - HTTP/SSE = network protocol (HTTP/1.1 + chunked transfer)
   - Client sends: `POST /sse` with method/params as JSON
   - Server responds: JSON-RPC response (or streaming SSE for tools)

### 5.2 MCP Protocol Over SSE

```
Client Browser                Supergateway              MCP Server
      │                             │                        │
      │──(POST /sse)────────────────│                        │
      │  {                          │                        │
      │    "jsonrpc": "2.0",        │                        │
      │    "method": "initialize",  │                        │
      │    "id": 1                  │                        │
      │  }                          │                        │
      │                             │──(write to stdin)──────│
      │                             │                        │
      │                             │<─(read from stdout)────│
      │                             │  {                     │
      │                             │    "jsonrpc": "2.0",   │
      │                             │    "result": {...},    │
      │                             │    "id": 1             │
      │                             │  }                     │
      │<────(SSE JSON)──────────────│                        │
      │  data: {...result...}       │                        │
      │                             │                        │
```

### 5.3 Key Translation Layers

**Layer 1: Stdio → Supergateway**
- E2B executes supergateway binary
- Supergateway forks MCP server as child process
- IPC: stdin/stdout pipes for JSON-RPC messages

**Layer 2: Supergateway → HTTP/SSE**
- Supergateway starts HTTP server on port 3000
- Exposes `/sse` endpoint
- HTTP handler reads request → MCP → HTTP response

**Layer 3: E2B → Client**
- E2B tunnels port 3000 through HTTPS
- Client connects to generated domain name
- TLS encryption end-to-end

---

## 6. E2B SANDBOX INTEGRATION

### 6.1 Why E2B?

**E2B (Edge to Browser)** provides:

1. **Ephemeral Containers**
   - Automatic cleanup after timeout
   - No infrastructure management
   - Pay-per-use billing

2. **Sandboxing & Security**
   - Container isolation (process + filesystem)
   - Limited resource access
   - Network restrictions (outbound needs explicit allowance)

3. **Network Connectivity**
   - Automatic HTTPS with valid certificates
   - Unique domain per sandbox
   - Built-in firewall

4. **Developer Experience**
   - Simple SDK (`Sandbox.create()`)
   - One API call to spawn and connect
   - Logs streaming support

### 6.2 Sandbox Configuration

```typescript
Sandbox.create("base", {
  timeoutMs: 1000 * 60 * 10,  // Default: 10 minutes
  apiKey: "e2b_...",          // Authentication
})
```

**Configuration Details**:

- **Template**: `"base"` 
  - Debian-based Linux with Node.js/npm pre-installed
  - ~500MB footprint

- **Timeout**: 10 minutes default (configurable)
  - Automatic cleanup after timeout
  - Can be longer or shorter based on needs

- **API Key**: Required for authentication
  - Obtained from E2B dashboard
  - Passed to consumer during `startMcpSandbox()` call

### 6.3 Resource Allocation

E2B allocates per sandbox:
- CPU: Shared virtual core(s)
- Memory: Typically 512MB-2GB (depends on plan)
- Disk: Limited ephemeral storage
- Network: Outbound HTTP/S (if enabled)

---

## 7. SUPERGATEWAY INTEGRATION DETAILS

### 7.1 Supergateway Command Breakdown

```bash
npx -y supergateway \
  --base-url https://<unique-id>.sandbox.e2b.dev \
  --port 3000 \
  --cors \
  --stdio "npx -y @modelcontextprotocol/server-brave-search"
```

**Flag Explanations**:

| Flag | Value | Purpose |
|------|-------|---------|
| `--base-url` | HTTPS URL | External URL that supergateway reports to clients (for callbacks/redirects) |
| `--port` | 3000 | Port to listen on inside container |
| `--cors` | (boolean) | Enable CORS headers (critical for browser clients) |
| `--stdio` | (flag) | Indicates MCP server uses stdio (not TCP/socket) |
| `"<command>"` | MCP server command | Quoted to preserve spaces/args in command |

### 7.2 Supergateway Request/Response Flow

**Initialize Request** (client → supergateway → MCP server):
```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "initialize",
  "params": {
    "protocolVersion": "2024-11-05",
    "capabilities": {...},
    "clientInfo": {
      "name": "mcp-client",
      "version": "1.0.0"
    }
  }
}
```

**List Tools Response** (MCP server → supergateway → client):
```json
{
  "jsonrpc": "2.0",
  "id": 2,
  "method": "tools/list",
  "result": {
    "tools": [
      {
        "name": "web_search",
        "description": "Search the web using Brave Search",
        "inputSchema": {
          "type": "object",
          "properties": {
            "query": {
              "type": "string",
              "description": "Search query"
            }
          }
        }
      }
    ]
  }
}
```

### 7.3 Tool Invocation Flow

```typescript
// Client calls tool through supergateway
{
  "jsonrpc": "2.0",
  "id": 3,
  "method": "tools/call",
  "params": {
    "name": "web_search",
    "arguments": {
      "query": "TypeScript best practices"
    }
  }
}

// Supergateway:
// 1. Writes JSON to MCP server stdin
// 2. Reads response from stdout
// 3. Streams response via SSE

// Response:
{
  "jsonrpc": "2.0",
  "id": 3,
  "result": {
    "content": [
      {
        "type": "text",
        "text": "[search results...]"
      }
    ]
  }
}
```

---

## 8. KEY DEPENDENCIES

### 8.1 Runtime Dependency

**@e2b/code-interpreter** (Peer Dependency)
- **Version**: ^1.1.0
- **Role**: E2B SDK for sandbox creation/management
- **Why Peer**: Allows projects to use different versions
- **API Used**:
  - `Sandbox.create(template, config)`
  - `sandbox.getHost(port)`
  - `sandbox.commands.run(command, options)`

### 8.2 Development Dependencies

```json
{
  "@babel/plugin-transform-modules-commonjs": "^7.23.0",    // CommonJS transpiling
  "@types/fs-extra": "^11.0.2",                              // fs-extra type defs
  "@types/node": "^20.6.5",                                  // Node.js type defs
  "cross-env": "^7.0.3",                                     // Cross-platform ENV vars
  "fs-extra": "^11.1.1",                                     // File system utilities
  "ts-node": "^10.9.1",                                      // TypeScript execution
  "typescript": "^5.0.2",                                    // TypeScript compiler
  "vite": "^4.4.5",                                          // Build tool
  "vite-plugin-dts": "^3.5.4",                               // TypeScript .d.ts generation
  "vite-tsconfig-paths": "^4.2.1"                            // Path alias support
}
```

### 8.3 Zero Runtime Dependencies

- No production dependencies aside from peer dependency
- Minimal footprint in final bundle
- TypeScript compiles to plain JavaScript with no external libraries

---

## 9. BUILD SYSTEM & DISTRIBUTION

### 9.1 Dual Module Build Strategy

The project uses a sophisticated build system to support both ES Modules and CommonJS:

**Build Process** (scripts/build.js):

```
1. Clean dist/
2. Build ESM (MODULE=esm):
   - Vite compiles to ES module format
   - Outputs: dist/esm/mcp-sandbox.es.js
   - Outputs: dist/esm/mcp-sandbox.d.ts (TypeScript definitions)
   - Create: dist/esm/package.json { type: "module" }
   
3. Build CJS (MODULE=cjs):
   - Vite compiles to UMD (Universal Module Definition) format
   - Outputs: dist/cjs/mcp-sandbox.umd.js
   - Create: dist/cjs/package.json { type: "commonjs" }
```

### 9.2 Package.json Export Configuration

```json
{
  "main": "./dist/cjs/mcp-sandbox.umd.js",
  "module": "./dist/esm/mcp-sandbox.es.js",
  "types": "./dist/esm/mcp-sandbox.d.ts",
  "exports": {
    "import": "./dist/esm/mcp-sandbox.es.js",
    "require": "./dist/cjs/mcp-sandbox.umd.js",
    "types": "./dist/esm/mcp-sandbox.d.ts"
  }
}
```

**Module Resolution**:
- `import` statements → ESM version
- `require()` calls → UMD version
- TypeScript type checking → TypeScript definitions

### 9.3 Vite Configuration

```typescript
// vite.config.ts key settings

{
  plugins: [
    tsconfigPaths(),           // Path alias resolution
    dts({                       // TypeScript definition generation
      tsconfigPath: module === 'esm' ? 'tsconfig.json' : 'tsconfig.cjs.json',
      rollupTypes: true,        // Inline deps into single .d.ts
    }),
  ],
  build: {
    target: module === 'esm' ? 'esnext' : 'es2015',  // Target compatibility
    lib: {
      entry: resolve(__dirname, 'src', 'index.ts'),
      name: '@netglade/mcp-sandbox',
      formats: [module === 'esm' ? 'es' : 'umd'],
    },
    rollupOptions: {
      external: [
        ...builtinModules,               // Node.js built-ins
        ...Object.keys(peerDependencies), // Peer deps (don't bundle)
      ],
    },
  }
}
```

### 9.4 TypeScript Configuration

**tsconfig.base.json** (shared):
```json
{
  "compilerOptions": {
    "strict": true,                 // Strict type checking
    "declaration": true,            // Generate .d.ts files
    "esModuleInterop": true,        // Import CJS as ES module
    "moduleResolution": "node",     // Node.js module resolution
    "resolveJsonModule": true,      // Allow importing JSON
    "skipLibCheck": true,           // Skip node_modules type checking
    "lib": ["esnext"]               // Latest JavaScript features
  }
}
```

---

## 10. API/METHODS EXPOSED

### 10.1 Main Export

```typescript
// Named exports
export { startMcpSandbox };
export type { McpSandbox };
```

### 10.2 Function Signature

```typescript
startMcpSandbox({
  command: string                    // MCP server command
  apiKey: string                     // E2B authentication key
  envs?: Record<string, string>      // Optional environment variables
  timeoutMs?: number                 // Sandbox lifetime (default: 10 min)
}): Promise<McpSandbox>
```

### 10.3 McpSandbox Instance Methods

```typescript
class McpSandbox {
  // Property
  sandbox: Sandbox                   // Underlying E2B Sandbox instance
  
  // Methods
  getUrl(): string                   // Returns: https://<host>/sse
}
```

### 10.4 Usage Pattern

```typescript
import { startMcpSandbox } from '@netglade/mcp-sandbox';

// Step 1: Start sandbox
const mcpSandbox = await startMcpSandbox({
  command: 'npx -y @modelcontextprotocol/server-brave-search',
  apiKey: 'e2b_YOUR_API_KEY',
  envs: {
    BRAVE_API_KEY: 'your-brave-key'  // Pass secrets securely
  },
  timeoutMs: 600000                  // 10 minutes
});

// Step 2: Get connection URL
const mcpUrl = mcpSandbox.getUrl();
// Result: https://d7f3c9.sandbox.e2b.dev/sse

// Step 3: Connect your AI client
const client = new MCPClient(mcpUrl);
await client.initialize();
const tools = await client.listTools();
```

---

## 11. EXAMPLE USAGE PATTERNS

### 11.1 Basic Web Search Integration

```typescript
// In a Claude-powered AI application

import { startMcpSandbox } from '@netglade/mcp-sandbox';
import Anthropic from '@anthropic-ai/sdk';

async function setupMCPWithClaude() {
  // 1. Launch MCP sandbox
  const mcpSandbox = await startMcpSandbox({
    command: 'npx -y @modelcontextprotocol/server-brave-search',
    apiKey: process.env.E2B_API_KEY,
    envs: {
      BRAVE_API_KEY: process.env.BRAVE_API_KEY
    }
  });

  const mcpUrl = mcpSandbox.getUrl();

  // 2. Configure Claude to use MCP
  const client = new Anthropic();
  
  // 3. Make request with tool use
  const response = await client.messages.create({
    model: 'claude-3-5-sonnet-20241022',
    max_tokens: 1024,
    tools: [
      {
        type: 'mcp',
        name: 'mcp_server',
        uri: mcpUrl  // SSE endpoint
      }
    ],
    messages: [
      {
        role: 'user',
        content: 'Search for information about TypeScript and summarize'
      }
    ]
  });

  // 4. Claude uses MCP tools as needed
  return response;
}
```

### 11.2 File System Tool Integration

```typescript
const mcpSandbox = await startMcpSandbox({
  command: 'npx -y @modelcontextprotocol/server-filesystem --root /home/user/documents',
  apiKey: process.env.E2B_API_KEY,
  envs: {
    // File operations happen in sandbox
  },
  timeoutMs: 30 * 60 * 1000  // 30 minutes for longer work
});

// Now AI can:
// - List files
// - Read file contents
// - Write files
// - All sandboxed in /home/user/documents
```

### 11.3 Custom MCP Server

```typescript
// In a Node.js MCP server (stdio-based)
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';

const server = new Server({
  name: 'my-custom-server',
  version: '1.0.0'
});

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [
    {
      name: 'custom_tool',
      description: 'My custom tool',
      inputSchema: {...}
    }
  ]
}));

const transport = new StdioServerTransport();
await server.connect(transport);

// Then run in mcp-sandbox:
await startMcpSandbox({
  command: 'node /path/to/my-server.js',  // Your custom server
  apiKey: 'e2b_...'
});
```

### 11.4 Multiple MCP Servers (Sequential)

```typescript
async function setupMultipleMCPServers() {
  const searchMcp = await startMcpSandbox({
    command: 'npx -y @modelcontextprotocol/server-brave-search',
    apiKey: process.env.E2B_API_KEY,
    envs: { BRAVE_API_KEY: process.env.BRAVE_API_KEY }
  });

  const filesystemMcp = await startMcpSandbox({
    command: 'npx -y @modelcontextprotocol/server-filesystem --root /tmp',
    apiKey: process.env.E2B_API_KEY
  });

  return {
    searchUrl: searchMcp.getUrl(),
    filesystemUrl: filesystemMcp.getUrl()
  };
}

// Note: Each server gets its own isolated E2B container
// No resource contention between servers
```

---

## 12. SECURITY ARCHITECTURE

### 12.1 Defense Layers

```
Layer 1: Network Isolation
├─ E2B container sandboxing
├─ Private network per sandbox
└─ No direct access from internet

Layer 2: Process Isolation
├─ MCP server runs as unprivileged user
├─ Linux cgroup resource limits
└─ No access to host filesystem

Layer 3: Environment Isolation
├─ Ephemeral filesystem (read-write, then deleted)
├─ Isolated environment variables
└─ No cross-sandbox data leakage

Layer 4: Credential Management
├─ API keys never stored in container
├─ Passed via environment variables
└─ Sandbox cleanup wipes everything

Layer 5: Communication Security
├─ HTTPS/TLS for all connections
├─ Valid certificates (E2B managed)
└─ SSE over encrypted channel
```

### 12.2 Security Implications

**Good**:
- Tools execute in isolated environment
- No access to local machine
- Ephemeral (automatic cleanup)
- TLS encrypted communication

**Consider**:
- MCP server command injection risk (validate command input)
- Environment variables may contain secrets (E2B secures at platform level)
- API key needed for E2B authentication
- Sandbox timeout risk (long-running operations may be interrupted)

---

## 13. PERFORMANCE CHARACTERISTICS

### 13.1 Latency Breakdown

```
Typical request latency (cold start to response):
├─ Sandbox creation: 2-5 seconds (E2B container allocation)
├─ Supergateway startup: 1-2 seconds
├─ MCP server startup: 1-3 seconds (depends on server)
├─ HTTP request round-trip: 100-500ms
└─ Tool execution: Server-specific (search: 1-5s, file ops: <100ms)

Total cold start: 4-11 seconds
Warm request: 100-2000ms (depending on tool)
```

### 13.2 Resource Usage

**Per Sandbox**:
- Memory: 100-200MB (idle), up to 1GB+ under load
- CPU: Minimal (shared vCPU)
- Storage: Ephemeral, limited to container allocation
- Network: Outbound only (if configured)

**Billing** (E2B):
- Per sandbox-second
- Example: 10 min sandbox = 600 seconds cost

---

## 14. KNOWN ISSUES & EVOLUTION

### 14.1 Commit History Insights

| Version | Commit | Change | Impact |
|---------|--------|--------|--------|
| 0.0.2 | fcb025b | Initial working version | Basic functionality |
| 0.0.3 | 163d5fd | Optional arguments | Better API |
| 0.0.4 | b7b87e0 | Generic command support | More flexible MCP servers |
| 0.0.5 | e65eec6 | README improvements | Better documentation |
| 0.0.6 | 5f5db46 | Smaller bundle size | Optimization |
| 0.0.7 | aa5cc42 | Export McpSandbox type | TypeScript support |
| 0.0.8 | b6a0c2f | (feature) | |
| 0.0.9 | 930eb82 | (feature) | |
| **0.0.9** | **17e7bf0** | **Add CORS support** | **Critical for browser use** |
| 0.0.10 | 697786b | (maintenance) | |
| **0.0.10** | **cdc0a37** | **Fix argument order** | **--cors before --stdio** |
| 0.0.11 | 2f7bdb7 | Version bump | Current stable |

### 14.2 Recent Bug Fix

**Commit cdc0a37 (fix arg order)**: 
- Fixed supergateway command flag order
- `--cors --stdio` → `--cors` must come before stdio command
- Critical for CORS headers to be properly applied

---

## 15. INTEGRATION PATTERNS

### 15.1 With Anthropic's Claude

```typescript
// Claude integration pattern
const mcpServer = await startMcpSandbox({
  command: 'npx -y @modelcontextprotocol/server-brave-search',
  apiKey: process.env.E2B_API_KEY
});

// Use with Claude API (when MCP support is available)
const response = await client.messages.create({
  model: 'claude-3-5-sonnet-20241022',
  max_tokens: 1024,
  tools: [{
    type: 'mcp',
    uri: mcpServer.getUrl()
  }],
  messages: [{
    role: 'user',
    content: 'Use the MCP tools to help me...'
  }]
});
```

### 15.2 With Custom MCP Clients

```typescript
// Generic MCP client
import { SSEClientTransport } from '@modelcontextprotocol/sdk/client/sse.js';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';

const mcpServer = await startMcpSandbox({
  command: 'npx -y @modelcontextprotocol/server-brave-search',
  apiKey: process.env.E2B_API_KEY
});

const transport = new SSEClientTransport({
  url: mcpServer.getUrl()
});

const client = new Client({
  name: 'my-client',
  version: '1.0.0'
}, {
  capabilities: {}
});

await client.connect(transport);
const resources = await client.listTools();
```

### 15.3 Streaming Responses

```typescript
// Supergateway supports streaming via SSE
const response = await fetch(mcpServer.getUrl(), {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    jsonrpc: '2.0',
    id: 1,
    method: 'tools/call',
    params: {
      name: 'web_search',
      arguments: { query: 'TypeScript tips' }
    }
  })
});

// Response is SSE format
for await (const chunk of response.body) {
  const line = new TextDecoder().decode(chunk);
  if (line.startsWith('data: ')) {
    const data = JSON.parse(line.slice(6));
    console.log('Streamed data:', data);
  }
}
```

---

## 16. DEPLOYMENT CONSIDERATIONS

### 16.1 Browser-Based Deployment

```typescript
// In a Next.js/Vite frontend application

// pages/api/mcp-setup.ts (Next.js API route)
import { startMcpSandbox } from '@netglade/mcp-sandbox';

export default async function handler(req, res) {
  const mcpSandbox = await startMcpSandbox({
    command: 'npx -y @modelcontextprotocol/server-brave-search',
    apiKey: process.env.E2B_API_KEY,
    envs: {
      BRAVE_API_KEY: process.env.BRAVE_API_KEY
    }
  });

  res.json({ mcpUrl: mcpSandbox.getUrl() });
}
```

### 16.2 Server-Side Deployment

```typescript
// In a Node.js backend

import { startMcpSandbox } from '@netglade/mcp-sandbox';
import express from 'express';

const app = express();
let mcpSandbox;

app.post('/api/initialize-mcp', async (req, res) => {
  if (!mcpSandbox) {
    mcpSandbox = await startMcpSandbox({
      command: 'npx -y @modelcontextprotocol/server-brave-search',
      apiKey: process.env.E2B_API_KEY,
      timeoutMs: 30 * 60 * 1000  // 30 minutes
    });
  }
  
  res.json({ url: mcpSandbox.getUrl() });
});

app.listen(3000);
```

### 16.3 Environment Variables

```bash
# Required
E2B_API_KEY=e2b_YOUR_API_KEY

# Optional (depends on MCP server)
BRAVE_API_KEY=your_brave_search_key
DATABASE_URL=postgres://...
OPENAI_API_KEY=sk-...
```

---

## 17. COMPARISON WITH ALTERNATIVES

| Aspect | mcp-sandbox | Local MCP | Direct Cloud Deploy |
|--------|------------|----------|-------------------|
| Setup Complexity | Low (one API call) | Medium (node, npm) | High (containers, deployment) |
| Security | High (E2B sandboxing) | User's responsibility | Depends on infra |
| Scalability | Auto (E2B managed) | Manual | Auto (cloud-native) |
| Browser Compatible | Yes (SSE) | No (requires proxying) | Yes (API) |
| Cost | Per-second | Free (local) | Infrastructure cost |
| Cold Start | 5-10s | Instant | 1-2s |
| Maintenance | Zero (E2B manages) | User responsibility | Moderate |

---

## 18. KEY TECHNICAL INNOVATIONS

### 18.1 Why This Approach Works

1. **Minimal Wrapper**: Only ~60 lines of TypeScript
   - Delegates heavy lifting to E2B and supergateway
   - Easy to understand and modify
   - Minimal surface area for bugs

2. **Ephemeral by Design**: 
   - No persistent resources
   - Automatic cleanup
   - Cost-efficient

3. **Protocol Translation Problem Solved**:
   - stdio (IPC) → HTTP/SSE (network)
   - Supergateway solves this elegantly
   - Works with ANY stdio-based MCP server

4. **Browser-First Architecture**:
   - CORS support critical
   - SSE for reliable connections
   - Works in modern browsers

5. **Type-Safe Package**:
   - Full TypeScript support
   - Dual ESM/CJS build
   - Proper type exports

---

## 19. FUTURE POSSIBILITIES

### 19.1 Potential Enhancements

- **Multi-server orchestration**: Run multiple MCP servers in one sandbox
- **Persistent storage**: Attach volumes for state between runs
- **Custom sandboxes**: Use different E2B templates
- **Metrics/monitoring**: Expose performance data
- **Rate limiting**: Built-in request throttling
- **Custom supergateway config**: More control over HTTP layer
- **WebSocket support**: In addition to SSE

### 19.2 Ecosystem Opportunities

- Pre-configured templates for popular MCP servers
- Cloud hosting for MCP endpoints
- MCP server marketplace
- Performance analytics dashboard

---

## 20. CONCLUSION

**mcp-sandbox** is a elegant, production-ready solution for running Model Context Protocol servers in the cloud. By combining:

1. **E2B's sandbox infrastructure** (ephemeral, isolated execution)
2. **Supergateway's protocol translation** (stdio ↔ HTTP/SSE)
3. **Minimal TypeScript wrapper** (easy integration)

The package enables browser-based AI applications to safely access real-world tools without local setup or infrastructure complexity.

**Core Strengths**:
- Simple 1-line integration
- Browser-compatible (SSE)
- Secure (E2B sandboxing)
- Scalable (auto-managed)
- Well-maintained (active development)

**Perfect For**:
- AI assistants needing tool access
- Browser-based ML applications
- Serverless MCP server hosting
- Tool-augmented LLM applications

---

## References

- **Live Demo**: https://netglade.github.io/mcp-chat/
- **Demo Repository**: https://github.com/netglade/mcp-chat
- **E2B Documentation**: https://e2b.dev
- **Supergateway**: https://github.com/supercorp-ai/supergateway
- **MCP Specification**: https://spec.modelcontextprotocol.io/
- **Blog Post**: https://www.netglade.cz/en/blog/bringing-mcps-to-the-cloud-how-we-won-the-e2b-hackathon

