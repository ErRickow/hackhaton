# APILab - Browser-Based API Testing Playground

## 🎯 Project Overview

**Name:** APILab
**Tagline:** "Test any API in your browser with plain English - No Postman needed!"
**Target Hackathon:** E2B MCP Hackathon (Build MCP Agents with Docker, Groq, and E2B)

### Problem Statement
Testing APIs is painful:
- ❌ Need to install Postman, Insomnia, or curl
- ❌ Complex auth setup (OAuth, JWT, API keys)
- ❌ Webhook testing requires ngrok or local servers
- ❌ Hard to share test scenarios with team
- ❌ No natural language interface

### Solution
APILab is a browser-based API testing playground where you can:
- ✅ Test APIs using natural language ("Get the latest 10 users")
- ✅ Auto-detect API schemas (OpenAPI/Swagger)
- ✅ Generate temporary webhook endpoints in E2B sandboxes
- ✅ Visualize request/response flows
- ✅ Generate code snippets (curl, Python, JavaScript, Go)
- ✅ Share test scenarios via URL
- ✅ Zero installation - runs entirely in browser

---

## 🏆 Why This Will Win

### Follows NetGlade Winning Pattern
```
NetGlade Pattern:           APILab Pattern:
Browser-only ✅            → Browser-only ✅
E2B sandboxes ✅           → E2B sandboxes ✅
MCP servers ✅             → MCP servers ✅
Chat interface ✅          → Chat interface ✅
Zero setup ✅              → Zero setup ✅

DIFFERENCE:
Web search tools           → API testing tools
Read-only search           → Interactive API calls + webhooks
```

### Unique Differentiators
1. **Webhook endpoints in E2B** - No ngrok needed! ⭐
2. **Natural language** - "Test Stripe payment flow" → executes
3. **Visual flow diagrams** - See request → response → webhook
4. **Auto-tested code snippets** - All generated code actually works
5. **Multiple MCP integrations** - HTTP client, OpenAPI parser, GitHub

### Technical Alignment with Hackathon
- ✅ **E2B Sandboxes** - Core feature (webhook endpoints, code execution)
- ✅ **Docker MCP Catalog** - Uses multiple MCP servers
- ✅ **Groq (optional)** - Fast natural language parsing
- ✅ **Real-world problem** - Developers test APIs daily
- ✅ **Production-ready** - Can actually replace Postman for many use cases

---

## 🏗️ Architecture

### High-Level Flow
```
┌─────────────────────────────────────────┐
│     Browser (React 19 + TypeScript)     │
│  - Chat interface                       │
│  - Request/Response viewer              │
│  - Flow diagram visualizer              │
│  - Code snippet generator               │
└──────────────┬──────────────────────────┘
               ↓
┌──────────────────────────────────────────┐
│   Vercel AI SDK + Groq/Anthropic        │
│  - Parse natural language               │
│  - Generate API requests                │
│  - Tool calling (MCP servers)           │
└──────────────┬──────────────────────────┘
               ↓
┌──────────────────────────────────────────┐
│   @netglade/mcp-sandbox                 │
│  - Start E2B sandboxes                  │
│  - Convert stdio → SSE                  │
│  - Return HTTPS URLs                    │
└──────────────┬──────────────────────────┘
               ↓
┌──────────────────────────────────────────┐
│   E2B Cloud Sandboxes                   │
│  ┌────────────────────────────────────┐ │
│  │ MCP Server: HTTP Client            │ │
│  │ - Make API requests                │ │
│  │ - Handle auth (OAuth, JWT)         │ │
│  └────────────────────────────────────┘ │
│  ┌────────────────────────────────────┐ │
│  │ MCP Server: OpenAPI Parser         │ │
│  │ - Detect API schemas               │ │
│  │ - Generate request templates       │ │
│  └────────────────────────────────────┘ │
│  ┌────────────────────────────────────┐ │
│  │ MCP Server: Webhook Receiver       │ │
│  │ - Create temp HTTP endpoints       │ │
│  │ - Capture webhook events           │ │
│  └────────────────────────────────────┘ │
│  ┌────────────────────────────────────┐ │
│  │ MCP Server: Code Generator         │ │
│  │ - Generate curl/Python/JS          │ │
│  │ - Test generated code              │ │
│  └────────────────────────────────────┘ │
└──────────────────────────────────────────┘
```

### Data Flow
```
User Input: "Test Stripe payment success flow"
    ↓
[Groq/Claude] Parse intent → extract API details
    ↓
[HTTP Client MCP] Create Stripe checkout session
    ↓
[Webhook MCP] Generate temp endpoint: https://xyz.sandbox.e2b.dev/webhook
    ↓
[Display] Show checkout URL + webhook URL
    ↓
User completes payment
    ↓
[Webhook MCP] Receives POST from Stripe
    ↓
[Display] Show webhook payload + verify signature
    ↓
[Code Gen MCP] Generate test code (Jest/Pytest)
    ↓
[E2B] Test generated code
    ↓
[Display] Working code snippet ✅
```

---

## 🎨 UI/UX Design

### Main Interface (Inspired by NetGlade)

```
┌─────────────────────────────────────────────────────────┐
│  APILab 🧪                    [Settings] [Share] [Docs] │
├─────────────────────────────────────────────────────────┤
│                                                          │
│  ┌────────────────────────────────────────────────────┐ │
│  │  💬 Chat Interface                                 │ │
│  │                                                    │ │
│  │  User: Test the JSONPlaceholder API              │ │
│  │  Get the latest 10 users                         │ │
│  │                                                    │ │
│  │  Assistant: I'll test the JSONPlaceholder API    │ │
│  │  for you. Making request...                      │ │
│  │                                                    │ │
│  │  ✅ GET https://jsonplaceholder.typicode.com/... │ │
│  │  Status: 200 OK (142ms)                          │ │
│  │                                                    │ │
│  │  [View Response] [View Headers] [Generate Code]  │ │
│  │                                                    │ │
│  └────────────────────────────────────────────────────┘ │
│                                                          │
│  ┌────────────────────────────────────────────────────┐ │
│  │  📊 Request Flow Visualization                    │ │
│  │                                                    │ │
│  │  Browser → [GET] → jsonplaceholder.typicode.com  │ │
│  │            ↓                                       │ │
│  │         [200 OK]                                  │ │
│  │            ↓                                       │ │
│  │    [10 users returned]                           │ │
│  │                                                    │ │
│  └────────────────────────────────────────────────────┘ │
│                                                          │
│  ┌────────────────────────────────────────────────────┐ │
│  │  💻 Generated Code                                │ │
│  │                                                    │ │
│  │  [curl] [Python] [JavaScript] [Go]               │ │
│  │                                                    │ │
│  │  curl -X GET \                                    │ │
│  │    "https://jsonplaceholder.typicode.com/users\  │ │
│  │     ?_limit=10"                                   │ │
│  │                                                    │ │
│  │  [Copy] [Test in E2B] [Save]                     │ │
│  │                                                    │ │
│  └────────────────────────────────────────────────────┘ │
│                                                          │
│  [Type your API test request...]                        │
│                                                          │
└─────────────────────────────────────────────────────────┘
```

### Key UI Components

1. **Chat Interface** (Main interaction)
   - Natural language input
   - Streaming responses
   - Tool call visualization
   - Request/response display

2. **API Response Viewer**
   - JSON tree view
   - Headers inspector
   - Status code + timing
   - Response size

3. **Flow Diagram** (Visual)
   - Request path visualization
   - Webhook flow
   - Auth flow diagram
   - Error states

4. **Code Generator Panel**
   - Multiple language tabs
   - Syntax highlighting
   - Copy to clipboard
   - Test in E2B button

5. **Webhook Monitor** (Unique!)
   - Live webhook events
   - Payload viewer
   - Signature verification
   - Event history

---

## 🛠️ Technology Stack

### Frontend
```json
{
  "framework": "React 19",
  "language": "TypeScript",
  "bundler": "Vite",
  "styling": "Tailwind CSS",
  "ui-components": "Radix UI + shadcn/ui",
  "charts": "React Flow (for diagrams)",
  "syntax-highlighting": "Shiki or Prism"
}
```

### AI & MCP
```json
{
  "ai-sdk": "Vercel AI SDK (ai package)",
  "llm-providers": ["Groq (llama-3.3-70b)", "Anthropic (Claude)"],
  "mcp-wrapper": "@netglade/mcp-sandbox",
  "sandbox": "@e2b/code-interpreter"
}
```

### MCP Servers (To Build/Use)
1. **HTTP Client MCP** (Custom)
   - Make HTTP requests (GET, POST, PUT, DELETE, PATCH)
   - Handle various auth methods
   - Support headers, query params, body
   - Stream responses

2. **OpenAPI Parser MCP** (Custom)
   - Parse OpenAPI/Swagger specs
   - Extract endpoints
   - Generate request templates
   - Validate schemas

3. **Webhook Receiver MCP** (Custom - Key Feature!)
   - Create temporary HTTP endpoints
   - Receive webhook POSTs
   - Store events
   - Return event history

4. **Code Generator MCP** (Custom)
   - Generate curl commands
   - Generate Python (requests library)
   - Generate JavaScript (fetch/axios)
   - Generate Go (net/http)
   - Test generated code in E2B

5. **GitHub MCP** (Existing)
   - Save test collections
   - Create gists for sharing
   - Store API schemas

### State Management
```typescript
// Same pattern as NetGlade
- React useState (volatile state)
- useLocalStorage (persistence)
- React Query (async operations)
- Immer (immutable updates)
```

### Deployment
```
- GitHub Pages (static hosting)
- Cloudflare Pages (alternative)
- Vercel (if needed)
```

---

## 📋 MVP Features (48-Hour Hackathon Scope)

### Must-Have (Core Demo)
1. ✅ **Chat interface with AI**
   - Natural language parsing
   - Streaming responses
   - Tool calling

2. ✅ **Basic HTTP requests**
   - GET, POST methods
   - JSON requests/responses
   - Headers support

3. ✅ **Response visualization**
   - JSON tree view
   - Status codes
   - Response timing

4. ✅ **Code generation**
   - curl commands
   - Python requests
   - Copy to clipboard

5. ✅ **E2B sandbox integration**
   - Start MCP servers
   - Execute API calls
   - Test generated code

6. ✅ **Webhook endpoints** (Killer Feature!)
   - Generate temp URLs
   - Receive webhook POSTs
   - Display events

### Nice-to-Have (If Time Permits)
- ⭐ OpenAPI schema import
- ⭐ Auth flow helpers (OAuth)
- ⭐ Flow diagram visualization
- ⭐ Save/share test scenarios
- ⭐ Request history
- ⭐ More language code gen (Go, Rust)

### Out of Scope (Post-Hackathon)
- ❌ Complex auth flows (SAML, etc)
- ❌ GraphQL support
- ❌ WebSocket testing
- ❌ Performance testing/load
- ❌ Team collaboration features
- ❌ Paid integrations

---

## 🎯 Demo Script (5 Minutes)

### Opening (30 seconds)
```
"Hi! I'm presenting APILab - test any API in your browser with plain English.

No Postman, no curl, no installation needed. Just open your browser."
```

### Demo 1: Simple API Test (1 minute)
```
[Type] "Get the latest Bitcoin price from CoinGecko"

[Show]
- AI understands request
- Makes API call
- Shows response (price + chart)
- Generates curl command
- Copy & paste works ✅
```

### Demo 2: Webhook Testing (2 minutes) - KILLER FEATURE!
```
[Type] "Test a webhook from webhook.site"

[Show]
- AI generates temporary endpoint: https://abc123.sandbox.e2b.dev/webhook
- Send test POST to that URL
- Webhook event appears in real-time
- Show request payload
- Generate test code (Jest)
- Run test in E2B ✅

"This is running in an E2B sandbox - no local server needed!"
```

### Demo 3: API with Auth (1 minute)
```
[Type] "Test GitHub API - get my repositories"

[Show]
- AI detects need for auth token
- User provides token (securely)
- Makes authenticated request
- Shows repos
- Generates Python code with auth
```

### Closing (30 seconds)
```
"APILab uses:
- E2B sandboxes for secure execution ✅
- Multiple MCP servers (HTTP client, webhook receiver, code gen) ✅
- Groq for fast natural language parsing ✅
- All running in your browser - zero installation ✅

Perfect for developers, QA engineers, and anyone testing APIs."

[Show GitHub repo]
"It's open source - check it out!"
```

---

## 🧩 MCP Server Implementation Details

### 1. HTTP Client MCP Server
```typescript
// Run in E2B sandbox
// Exposes tools: make_request, set_auth, etc.

interface HttpClientTools {
  make_request: {
    url: string
    method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH'
    headers?: Record<string, string>
    body?: any
    query?: Record<string, string>
  }

  set_bearer_token: {
    token: string
  }

  set_api_key: {
    key: string
    headerName: string // e.g., "X-API-Key"
  }
}
```

### 2. Webhook Receiver MCP Server
```typescript
// Run in E2B sandbox
// Creates HTTP server on random port
// E2B exposes it via HTTPS

interface WebhookTools {
  create_webhook: {
    path?: string // defaults to /webhook
  }

  get_webhook_url: {} // Returns https://xxx.sandbox.e2b.dev/webhook

  get_events: {} // Returns all received webhook POSTs

  clear_events: {}
}

// Implementation:
// - Start Express server in E2B sandbox
// - Listen on port (E2B auto-proxies to HTTPS)
// - Store events in memory
// - Return via MCP tools
```

### 3. Code Generator MCP Server
```typescript
interface CodeGenTools {
  generate_curl: {
    request: HttpRequest
  }

  generate_python: {
    request: HttpRequest
    library: 'requests' | 'httpx' | 'urllib'
  }

  generate_javascript: {
    request: HttpRequest
    library: 'fetch' | 'axios'
  }

  test_code: {
    code: string
    language: 'python' | 'javascript'
  } // Execute in E2B and verify works
}
```

### 4. OpenAPI Parser MCP Server
```typescript
interface OpenAPITools {
  parse_spec: {
    url?: string
    spec?: object
  }

  list_endpoints: {}

  get_endpoint_schema: {
    path: string
    method: string
  }

  generate_example_request: {
    path: string
    method: string
  }
}
```

---

## 📦 Project Structure

```
apilab/
├── public/
│   └── favicon.ico
├── src/
│   ├── components/
│   │   ├── ui/              # Radix UI components (from shadcn)
│   │   │   ├── button.tsx
│   │   │   ├── card.tsx
│   │   │   ├── input.tsx
│   │   │   ├── tabs.tsx
│   │   │   └── ...
│   │   ├── Chat.tsx         # Main chat interface
│   │   ├── ResponseViewer.tsx  # JSON/response display
│   │   ├── FlowDiagram.tsx  # Visual flow (React Flow)
│   │   ├── CodeGenerator.tsx   # Code snippets panel
│   │   ├── WebhookMonitor.tsx  # Live webhook events
│   │   └── ApiSettings.tsx  # API keys, config
│   ├── hooks/
│   │   ├── useMcpApiTools.ts   # Start MCP servers
│   │   ├── useApiChat.ts       # Chat + AI integration
│   │   ├── useLocalStorage.ts  # Persistence
│   │   └── useWebhookEvents.ts # Poll webhook events
│   ├── lib/
│   │   ├── mcp-client.ts    # MCP SDK wrapper
│   │   ├── api-parser.ts    # Request parsing
│   │   └── code-gen.ts      # Code generation helpers
│   ├── types/
│   │   └── index.ts         # TypeScript types
│   ├── App.tsx
│   ├── main.tsx
│   └── index.css
├── mcp-servers/             # Custom MCP servers
│   ├── http-client/
│   │   ├── src/
│   │   │   └── index.ts
│   │   ├── package.json
│   │   └── tsconfig.json
│   ├── webhook-receiver/
│   │   ├── src/
│   │   │   └── index.ts
│   │   └── package.json
│   ├── code-generator/
│   │   └── ...
│   └── openapi-parser/
│       └── ...
├── package.json
├── vite.config.ts
├── tailwind.config.js
├── tsconfig.json
└── README.md
```

---

## 🚀 Implementation Plan

### Phase 1: Setup & Foundation (4-6 hours)
- [ ] Create Vite + React + TypeScript project
- [ ] Install dependencies (Vercel AI SDK, Tailwind, Radix UI)
- [ ] Setup basic UI structure (copy from NetGlade)
- [ ] Configure Tailwind + shadcn/ui components
- [ ] Create basic chat interface

### Phase 2: MCP Servers (8-10 hours)
- [ ] Build HTTP Client MCP server
  - Basic GET/POST requests
  - Headers support
  - Auth handling (Bearer token, API key)
- [ ] Build Webhook Receiver MCP server
  - Express server in E2B
  - Event storage
  - SSE streaming of events
- [ ] Build Code Generator MCP server
  - curl generation
  - Python (requests) generation
  - JavaScript (fetch) generation
- [ ] Test all MCP servers locally
- [ ] Deploy to E2B sandboxes

### Phase 3: Frontend Integration (8-10 hours)
- [ ] Integrate Vercel AI SDK
- [ ] Setup Groq/Anthropic provider
- [ ] Implement `useMcpApiTools` hook
- [ ] Implement `useApiChat` hook
- [ ] Connect chat to MCP tools
- [ ] Build response viewer
- [ ] Build code generator panel
- [ ] Build webhook monitor

### Phase 4: Polish & Features (6-8 hours)
- [ ] Add syntax highlighting
- [ ] Implement localStorage persistence
- [ ] Add copy-to-clipboard
- [ ] Create flow diagram (basic)
- [ ] Add error handling
- [ ] Improve UI/UX
- [ ] Add loading states

### Phase 5: Testing & Demo (4-6 hours)
- [ ] End-to-end testing
- [ ] Test with real APIs (GitHub, JSONPlaceholder, CoinGecko)
- [ ] Test webhook flow
- [ ] Create demo script
- [ ] Record demo video
- [ ] Write documentation

### Phase 6: Deployment (2-3 hours)
- [ ] Setup GitHub Pages
- [ ] Configure deployment
- [ ] Test production build
- [ ] Create README
- [ ] Submit to hackathon

**Total Estimated Time:** 32-43 hours (fits in 48-hour hackathon!)

---

## 🔑 Environment Variables Needed

```bash
# .env.local
VITE_E2B_API_KEY=your_e2b_key          # Get from e2b.dev
VITE_GROQ_API_KEY=your_groq_key        # Get from console.groq.com
VITE_ANTHROPIC_API_KEY=your_claude_key # Optional, fallback
```

---

## 📊 Success Metrics

### Demo Impact
- ✅ Wow factor: Webhook endpoints with zero setup
- ✅ Practical: Actually useful for daily API testing
- ✅ Technical: Multiple MCP integrations
- ✅ Visual: Flow diagrams + code generation

### Judging Criteria Alignment

| Criteria | How APILab Scores | Evidence |
|----------|------------------|----------|
| **Utility & Relevance** | ⭐⭐⭐⭐⭐ | Developers test APIs daily |
| **Creativity & Originality** | ⭐⭐⭐⭐⭐ | Webhook endpoints in browser - novel! |
| **MCP Integration** | ⭐⭐⭐⭐⭐ | 4+ custom MCP servers |
| **E2B Value** | ⭐⭐⭐⭐⭐ | Critical for webhooks + code testing |
| **Production-Ready** | ⭐⭐⭐⭐ | Can replace Postman for many use cases |
| **Technical Quality** | ⭐⭐⭐⭐ | Clean code, TypeScript, tested |

---

## 🎁 Bonus Features (Post-Hackathon)

1. **Collections** - Save & organize API tests
2. **Team Sharing** - Share test scenarios
3. **Environment Variables** - Manage different envs
4. **GraphQL Support** - Query/mutation testing
5. **OAuth Flow Helper** - Visual OAuth flow
6. **API Mocking** - Mock responses for testing
7. **Performance Testing** - Simple load tests
8. **CI/CD Integration** - Export to GitHub Actions

---

## 📚 Resources & References

### Inspiration
- NetGlade mcp-chat: https://github.com/netglade/mcp-chat
- NetGlade mcp-sandbox: https://github.com/netglade/mcp-sandbox
- Postman: https://www.postman.com
- Hoppscotch: https://hoppscotch.io
- Webhook.site: https://webhook.site

### Documentation
- E2B Docs: https://e2b.dev/docs
- Vercel AI SDK: https://sdk.vercel.ai
- MCP Spec: https://modelcontextprotocol.io
- Groq Docs: https://console.groq.com/docs

### MCP Servers
- Official servers: https://github.com/modelcontextprotocol/servers
- Docker MCP Catalog: https://hub.docker.com/mcp

---

## ✅ Next Steps

1. **Review this plan** - Any questions or changes?
2. **Setup environment** - Get API keys (E2B, Groq)
3. **Start Phase 1** - Create project structure
4. **Build incrementally** - Test each component
5. **Demo early, demo often** - Practice presentation

---

## 🏆 Winning Strategy Summary

**Why APILab Will Win:**
1. ✅ Exact same architecture as NetGlade winner
2. ✅ Different, practical use case (API testing)
3. ✅ Killer feature: Browser-based webhooks (no one else has this!)
4. ✅ Multiple MCP servers (shows technical depth)
5. ✅ E2B critical (enables the magic)
6. ✅ Visual + interactive demo
7. ✅ Production-ready potential
8. ✅ Open source contribution

**Elevator Pitch:**
"APILab is like Postman, but runs entirely in your browser with zero installation. Test any API using natural language, get temporary webhook endpoints instantly, and generate working code snippets - all powered by E2B sandboxes and MCP servers."

---

**Let's build this! 🚀**
