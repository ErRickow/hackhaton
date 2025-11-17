# APILab Architecture - Option 4: Full Browser SSE Client

## 🎯 Overview

APILab menggunakan **Option 4: Full Browser SSE Client (Pure Official Way)** untuk integras E2B MCP Official API. Pendekatan ini memisahkan operasi Node.js (sandbox creation) ke backend, sedangkan frontend hanya handle connection via browser-compatible MCP SDK.

## 🏗️ Architecture Diagram

```
┌──────────────────────────────────────────────────────────────────┐
│                         Browser (Frontend)                        │
│                                                                   │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │  React App (Vite)                                           ││
│  │  - Settings UI (API keys in localStorage)                  ││
│  │  - Chat Interface                                            ││
│  │  - useMcpTools Hook                                          ││
│  └─────────────────────────────────────────────────────────────┘│
│                              │                                    │
│                              │ 1. POST /api/mcp/init             │
│                              ▼                                    │
└──────────────────────────────────────────────────────────────────┘
                               │
                               │ { apiKey, mcpServers }
                               │
┌──────────────────────────────▼───────────────────────────────────┐
│                    Backend Server (Node.js/Bun)                   │
│                         Port 3001                                 │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │  Bun HTTP Server (api/index.ts)                             ││
│  │  - POST /api/mcp/init                                        ││
│  │  - GET /api/mcp/sandbox/:id                                  ││
│  │  - GET /health                                                ││
│  └─────────────────────────────────────────────────────────────┘│
│                              │                                    │
│                              │ 2. Sandbox.betaCreate()           │
│                              ▼                                    │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │  e2b Package (Node.js only)                                 ││
│  │  - Create E2B sandbox with MCP gateway                      ││
│  │  - Get MCP URL + Token                                       ││
│  └─────────────────────────────────────────────────────────────┘│
│                              │                                    │
│                              │ { sandboxId, mcpUrl, mcpToken }   │
│                              ▼                                    │
└──────────────────────────────────────────────────────────────────┘
                               │
                               │ 3. Return to Frontend
                               │
┌──────────────────────────────▼───────────────────────────────────┐
│                         Browser (Frontend)                        │
│                                                                   │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │  MCP SDK Client (@modelcontextprotocol/sdk)                 ││
│  │  - StreamableHTTPClientTransport (browser-compatible!)       ││
│  │  - Connect to mcpUrl with mcpToken                          ││
│  │  - client.listTools()                                        ││
│  └─────────────────────────────────────────────────────────────┘│
│                              │                                    │
│                              │ 4. SSE Connection                 │
│                              ▼                                    │
└──────────────────────────────────────────────────────────────────┘
                               │
                               │ Server-Sent Events (SSE)
                               │
┌──────────────────────────────▼───────────────────────────────────┐
│                       E2B Cloud MCP Gateway                       │
│                   https://xxx.e2b.dev/mcp                         │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │  MCP Gateway (E2B Official)                                 ││
│  │  - Built-in MCP servers: duckduckgo, arxiv                  ││
│  │  - SSE transport for browser compatibility                   ││
│  │  - Tool execution in secure sandbox                          ││
│  └─────────────────────────────────────────────────────────────┘│
└──────────────────────────────────────────────────────────────────┘
```

## 📦 Components

### 1. Frontend (Browser)

**Location**: `/src`
**Tech Stack**: React + Vite + TypeScript

**Key Files**:
- `src/hooks/useMcpTools.ts` - MCP integration hook
  - Calls backend API untuk create sandbox
  - Connects ke MCP gateway via SSE (browser-compatible!)
  - Converts MCP tools → AI SDK format

- `src/lib/groq-client.ts` - LLM streaming
  - Uses AI SDK v4 `streamText()`
  - Passes tools directly to LLM

- `src/components/Settings.tsx` - API key management
  - E2B, Neosantara, Groq keys
  - localStorage storage (zero-setup)

**Dependencies**:
- `@modelcontextprotocol/sdk@1.22.0` - Browser-compatible MCP client
- `ai@4.3.2` - Vercel AI SDK for LLM integration
- `@ai-sdk/openai@1.3.7` - OpenAI provider for AI SDK

### 2. Backend (Node.js/Bun)

**Location**: `/api`
**Tech Stack**: Bun + TypeScript

**Key Files**:
- `api/index.ts` - HTTP server with MCP endpoints
  - `POST /api/mcp/init` - Create sandbox, return URL + token
  - `GET /api/mcp/sandbox/:id` - Get sandbox status
  - `GET /health` - Health check

**Dependencies**:
- `e2b@2.7.0` - E2B Official SDK (Node.js only!)
- `cors@2.8.5` - CORS support

**Why Backend Needed?**:
Package `e2b` depend on Node.js APIs yang tidak exist di browser:
- `node:fs` - File system operations
- `node:crypto` - Cryptographic functions
- `node:path` - Path manipulations
- `node:url` - URL utilities

## 🔄 Data Flow

### Initialization Flow:

```typescript
// 1. Frontend calls backend API
const response = await fetch('http://localhost:3001/api/mcp/init', {
  method: 'POST',
  body: JSON.stringify({
    apiKey: 'e2b_***',
    mcpServers: { duckduckgo: {}, arxiv: {} }
  })
})

// 2. Backend creates sandbox (Node.js operation)
const sandbox = await Sandbox.betaCreate({
  apiKey,
  mcp: mcpServers,
  timeoutMs: 600_000
})

const mcpUrl = sandbox.betaGetMcpUrl()
const mcpToken = await sandbox.betaGetMcpToken()

// 3. Backend returns to frontend
return { sandboxId, mcpUrl, mcpToken }

// 4. Frontend connects via MCP SDK (browser-compatible!)
const client = new Client({ name: 'apilab', version: '1.0.0' })
const transport = new StreamableHTTPClientTransport(new URL(mcpUrl), {
  requestInit: {
    headers: { 'Authorization': `Bearer ${mcpToken}` }
  }
})

await client.connect(transport)

// 5. List and use tools
const toolsList = await client.listTools()
// Convert to AI SDK format and pass to streamText()
```

### Tool Execution Flow:

```typescript
// 1. User sends message requiring tool
const result = streamText({
  model: llmProvider('llama-3.3-70b-versatile'),
  messages: [...],
  tools: mcpTools, // Tools in AI SDK format
  maxSteps: 20
})

// 2. AI SDK automatically calls tools when needed
// Tools execute via MCP protocol (SSE) to E2B gateway

// 3. Results streamed back to frontend
for await (const chunk of result.fullStream) {
  if (chunk.type === 'text-delta') {
    // Display to user
  }
}
```

## 🚀 Setup & Running

### Prerequisites:
- Node.js 18+ atau Bun 1.0+
- E2B API key dari https://e2b.dev
- Neosantara atau Groq API key

### Installation:

```bash
# Install frontend dependencies
npm install

# Install backend dependencies
cd api
npm install
cd ..
```

### Running:

#### Option A: Run Both (Recommended)
```bash
npm run dev:all
```

#### Option B: Run Separately
```bash
# Terminal 1: Backend
npm run dev:api

# Terminal 2: Frontend
npm run dev
```

### Endpoints:
- Frontend: http://localhost:5173
- Backend: http://localhost:3001
- Backend Health: http://localhost:3001/health

## 🔐 Security Considerations

### ✅ Secure:
- E2B API key dapat diinput via UI (localStorage)
- Backend tidak store API keys (stateless)
- MCP connections authenticated dengan token
- E2B sandboxes isolated & auto-timeout

### ⚠️ For Production:
- Use environment variables untuk secrets
- Implement proper authentication (JWT, OAuth)
- Rate limiting pada backend endpoints
- Use Redis/DB untuk sandbox cache
- HTTPS untuk all connections

## 🎯 Why Option 4?

| Aspect | Option 4 (Current) | NetGlade (Old) | E2B Official Direct (Failed) |
|--------|-------------------|----------------|------------------------------|
| Browser Compatible | ✅ | ✅ | ❌ |
| Official E2B API | ✅ | ❌ | ✅ |
| Complexity | Medium | Low | N/A (not possible) |
| Maintenance | Official support | Community | N/A |
| Scalability | ✅ Backend scales | ⚠️ Client-side only | N/A |
| Security | ✅ Keys server-side | ⚠️ Keys client-side | N/A |

**Decision**: Option 4 adalah **best balance** antara official API, browser compatibility, dan scalability.

## 📚 References

- [E2B MCP Demo](https://github.com/e2b-dev/mcp-demo)
- [Model Context Protocol](https://modelcontextprotocol.io/)
- [E2B Documentation](https://e2b.dev/docs)
- [Vercel AI SDK](https://sdk.vercel.ai/docs)
