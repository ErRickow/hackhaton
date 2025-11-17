# MCP Chat Architecture Analysis

## Project Overview

MCP Chat is a browser-based application that enables running Model Context Protocol (MCP) servers in E2B's sandbox environment. It won the E2B Agents and AI Tools Hackathon and allows users to interact with MCP tools directly in the browser without local setup.

**Key Achievement**: Winner of E2B Agents and AI Tools Hackathon
**Tech Stack**: React 19 + TypeScript + Vite + Tailwind CSS
**Deployment**: GitHub Pages (Static Site)

---

## 1. PROJECT STRUCTURE

```
mcp-chat/
├── src/
│   ├── components/          # React components (UI + features)
│   │   ├── ui/             # Radix UI wrapper components
│   │   ├── Chat.tsx        # Main chat display component
│   │   ├── ChatInput.tsx    # Message input with toolbar
│   │   ├── ToolSettings.tsx # MCP server management dialog
│   │   ├── ApiKeySettings.tsx # API key configuration
│   │   ├── NavBar.tsx       # Top navigation bar
│   │   ├── ModelPicker.tsx  # LLM model selector
│   │   ├── TutorialCard.tsx # Side panel with info/help
│   │   ├── EmptyState.tsx   # Initial state with examples
│   │   ├── SetupGuide.tsx   # Setup instructions
│   │   ├── ThemeProvider.tsx # Dark/light mode
│   │   └── Other components
│   ├── hooks/               # Custom React hooks
│   │   ├── useChat.ts       # Chat logic with streaming
│   │   └── useMcpTools.ts   # MCP sandbox management
│   ├── types/               # TypeScript type definitions
│   │   ├── message.ts       # Chat message types
│   │   ├── mcpServer.ts     # MCP server/client types
│   │   ├── llmModel.ts      # Language model config types
│   │   └── toolCall.ts      # Tool invocation types
│   ├── lib/                 # Utilities and configs
│   │   ├── models.json      # Supported LLM models
│   │   ├── models.ts        # Model client factory
│   │   ├── messages.ts      # Message conversion utilities
│   │   ├── presets.json     # Quick-start MCP presets
│   │   └── utils.ts         # Helper functions (cn)
│   ├── assets/              # Images and logos
│   │   └── thirdparty/logos/ # Provider logos (SVG)
│   ├── App.tsx              # Root component
│   ├── main.tsx             # React render entry point
│   └── globals.css          # Tailwind + dark mode CSS
├── public/                  # Static assets
├── .github/
│   └── workflows/deploy.yml # GitHub Pages deployment
├── vite.config.ts           # Vite configuration
├── tailwind.config.ts       # Tailwind CSS config
├── components.json          # ShadCN UI config
├── tsconfig.json           # TypeScript config
├── package.json            # Dependencies
├── index.html              # HTML entry point
└── README.md               # Project documentation
```

---

## 2. E2B SANDBOX INTEGRATION

### How E2B Sandbox Works in This Project

**Library**: `@netglade/mcp-sandbox` (v0.0.10)

The MCP Sandbox library wraps E2B's SDK to run MCP servers in isolated cloud environments.

### Flow:

```
User Browser
    ↓
[Chat Interface] 
    ↓
[useMcpTools Hook]
    ├── Calls: startMcpSandbox({
    │     command: "npx -y @modelcontextprotocol/server-xyz",
    │     apiKey: e2bApiKey,
    │     envs: {...},  // Environment variables
    │     timeoutMs: 300000
    │   })
    ├── Receives: sandbox.getUrl() (HTTP endpoint)
    └── Polls: /url until server ready (6sec intervals, 5 attempts)
    ↓
[SSE Connection via MCP Client]
    ├── experimental_createMCPClient({
    │     transport: {
    │       type: 'sse',
    │       url: 'https://e2b-sandbox-url'
    │     }
    │   })
    └── Returns: aiClient with tools() method
    ↓
[AI Model]
    ├── Calls streamText() with tools
    ├── Executes tool calls via MCP
    └── Streams response back
```

### Key E2B Features Used:

1. **Isolated Execution**: Each MCP server runs in its own E2B sandbox
2. **HTTP/SSE Transport**: MCP communicates via HTTP Server-Sent Events
3. **Timeout Management**: 
   - Initial: 5 minutes (300,000ms)
   - Extended on use: 5 minutes per request
4. **Server Lifecycle**:
   - `sandbox.isRunning()` - Check if active
   - `sandbox.setTimeout()` - Extend timeout
   - `sandbox.kill()` - Terminate sandbox

### Relevant Code: `/home/user/hackhaton/mcp-chat/src/hooks/useMcpTools.ts` (lines 43-68)

---

## 3. MCP SERVERS INTEGRATION

### MCP Server Client Type

```typescript
type McpServerClient = {
  id: string
  configuration: McpServerConfiguration
  state: 'starting' | 'running' | 'error'
  sandbox?: McpSandbox                    // E2B sandbox instance
  url?: string                            // SSE endpoint URL
  client?: ExperimentalMCPClient          // AI SDK MCP client
  tools?: Record<string, Tool>            // Available tools
}

type McpServerConfiguration = {
  name: string                            // User-friendly name
  command: string                         // NPX/execution command
  envs: Record<string, string>            // Environment variables
  id: string                              // UUID for tracking
}
```

### Tool Collection Process

1. **Start Sandbox**: Execute MCP server command in E2B
2. **Get URL**: Receive HTTP/SSE endpoint
3. **Wait for Ready**: Poll endpoint until responsive
4. **Create MCP Client**: Use Vercel AI SDK's experimental MCP client
5. **Extract Tools**: Call `aiClient.tools()` to get available tools
6. **Merge Tools**: Combine tools from all running servers into single object

### MCP Presets

Pre-configured MCP servers available at `/home/user/hackhaton/mcp-chat/src/lib/presets.json`:

```json
{
  "presets": [
    {
      "name": "Brave Search",
      "command": "npx -y @modelcontextprotocol/server-brave-search",
      "envs": { "BRAVE_API_KEY": "" }
    },
    {
      "name": "E2B Interpreter",
      "command": "npx -y @e2b/mcp-server",
      "envs": { "E2B_API_KEY": "" }
    },
    {
      "name": "GitHub",
      "command": "npx -y @modelcontextprotocol/server-github",
      "envs": { "GITHUB_PERSONAL_ACCESS_TOKEN": "" }
    },
    {
      "name": "PostgreSQL",
      "command": "npx -y @modelcontextprotocol/server-postgres",
      "envs": {}
    }
  ]
}
```

---

## 4. FRONTEND ARCHITECTURE

### React Component Hierarchy

```
<QueryClientProvider>
  <ThemeProvider>
    <App>                          # State management (messages, configs)
      ├── <NavBar/>               # Title + clear button
      ├── <Chat/>                 # Message display + tool calls
      ├── <ChatInput/>            # Input form with toolbar
      │   ├── <ToolSettings/>     # MCP server management
      │   ├── <ApiKeySettings/>   # API key inputs
      │   └── <ModelPicker/>      # LLM selection
      ├── <TutorialCard/>         # Info panel (right side, XL screens)
      ├── <ErrorMessage/>         # Error display with retry
      └── <Footer/>               # Links/attribution
```

### State Management

**Location**: `/home/user/hackhaton/mcp-chat/src/App.tsx`

```typescript
// Local component state
const [messages, setMessages] = useState<Message[]>([])
const [chatInput, setChatInput] = useLocalStorage('chat', '')
const [error, setError] = useState<string | undefined>(undefined)
const [streamingContent, setStreamingContent] = useState<string>('')

// Persisted to localStorage
const [languageModelConfiguration, setLanguageModelConfiguration] = 
  useLocalStorage<LLMModelConfig>('languageModel', {...})
const [e2bApiKey, setE2bApiKey] = useLocalStorage<string>('e2bApiKey', '')
```

**Local Storage Keys**:
- `chat` - Current chat input
- `languageModel` - Selected model and API key
- `e2bApiKey` - E2B API key
- `mcpServerConfigurations` - Configured MCP servers (in useMcpTools hook)
- `vite-ui-theme` - Dark/light mode preference

### Key Hooks

#### 1. `useChat` Hook
- **File**: `/home/user/hackhaton/mcp-chat/src/hooks/useChat.ts`
- **Purpose**: Handle chat generation with streaming
- **Key Features**:
  - Extends/restarts MCP servers before each request
  - Merges tools from all running servers
  - Uses `streamText()` from Vercel AI SDK
  - Max 20 steps for agentic looping
  - Extracts tool calls from response messages
  - Real-time streaming via `onStreamUpdate` callback

**Tool Call Extraction**: Parses AI SDK message stream to extract:
```typescript
type ToolCall = {
  name: string
  arguments: Array<{ name: string, value: string }>
  result: string
  id: string
}
```

#### 2. `useMcpTools` Hook
- **File**: `/home/user/hackhaton/mcp-chat/src/hooks/useMcpTools.ts`
- **Purpose**: Manage MCP server lifecycle
- **Key Features**:
  - Start servers with `startMcpSandbox()`
  - Poll for server readiness (6s intervals)
  - Extend or restart timeouts
  - Add/remove servers with React Query mutations
  - Track server states (starting/running/error)

### Component Features

#### Chat Component (`Chat.tsx`)
- Scrollable message list with auto-scroll
- Tool call display (expandable sections)
- Markdown rendering with GitHub Flavored Markdown
- Streaming text updates
- Different styling for user vs assistant messages

#### ChatInput Component (`ChatInput.tsx`)
- Auto-expanding textarea
- Keyboard handling (Enter to send, Shift+Enter for newline)
- Settings/Model/API key dropdowns in toolbar
- Disabled state during loading
- Visual feedback with spinner

#### ToolSettings Component (`ToolSettings.tsx`)
- Dropdown menu with server list
- Add/remove MCP servers via dialog
- Server status indicators (running/error)
- Environment variable configuration
- Quick-start presets

#### ApiKeySettings Component (`ApiKeySettings.tsx`)
- Separate inputs for E2B and model API keys
- Password masking
- Required validation indicator

#### ThemeProvider Component (`ThemeProvider.tsx`)
- Dark/light mode toggle
- Persisted preference
- System preference fallback
- Radix UI Dialog integration

### UI Framework & Libraries

**Component Library**: Radix UI + ShadCN Components
- `@radix-ui/react-accordion`
- `@radix-ui/react-dialog`
- `@radix-ui/react-dropdown-menu`
- `@radix-ui/react-icons`
- `@radix-ui/react-label`
- `@radix-ui/react-select`
- `@radix-ui/react-slot`
- `@radix-ui/react-tooltip`

**Styling**:
- Tailwind CSS v3.4.17 (utility-first)
- Dark mode support via CSS variables
- Custom theme colors (primary, destructive, accent, etc.)
- ShadCN/ui preset with "new-york" style

**Other Libraries**:
- `lucide-react` - Icons
- `react-markdown` + `remark-gfm` - Markdown rendering
- `react-textarea-autosize` - Auto-expanding input
- `clsx` + `tailwind-merge` - CSS class utilities

---

## 5. KEY DEPENDENCIES (package.json)

### Runtime Dependencies

**AI & LLM**:
```json
{
  "@ai-sdk/anthropic": "^1.2.6",      // Anthropic API client
  "@ai-sdk/openai": "^1.3.7",         // OpenAI API client
  "ai": "^4.3.2",                     // Vercel AI SDK (core)
  "ollama-ai-provider": "^1.2.0"      // Ollama local model support
}
```

**MCP & Sandbox**:
```json
{
  "@netglade/mcp-sandbox": "^0.0.10"  // E2B MCP wrapper
}
```

**State & Data**:
```json
{
  "@tanstack/react-query": "^5.72.1", // Server state management
  "immer": "^10.1.1",                 // Immutable state updates
  "uuid": "^11.1.0"                   // Generate unique IDs
}
```

**UI Components**:
```json
{
  "react": "^19.0.0",
  "react-dom": "^19.0.0",
  "@radix-ui/*": "^1.x.x",            // 7 packages
  "lucide-react": "^0.487.0",         // Icons
  "react-markdown": "^10.1.0",
  "remark-gfm": "^4.0.1",
  "react-textarea-autosize": "^8.5.9"
}
```

**Styling**:
```json
{
  "tailwindcss": "^3.4.17",
  "tailwind-merge": "^2.6.0",
  "class-variance-authority": "^0.7.1",
  "clsx": "^2.1.1",
  "tailwindcss-animate": "^1.0.7"
}
```

**Utilities**:
```json
{
  "usehooks-ts": "^3.1.1"             // React hooks library
}
```

### Dev Dependencies

- TypeScript 5.7.2 (strict mode)
- Vite 6.2.0 (bundler)
- ESLint + Prettier (code quality)
- Tailwind CSS PostCSS plugin

---

## 6. SUPERGATEWAY / SSE IMPLEMENTATION

### What is SSE (Server-Sent Events)?

SSE is an HTTP protocol for server-to-client streaming. Used here for MCP server communication.

### Flow in MCP Chat

```
Browser Client
    ↓
[Vercel AI SDK: experimental_createMCPClient]
    │
    ├── Transport Config:
    │   {
    │     type: 'sse',
    │     url: 'https://e2b-sandbox.../mcp/sse'
    │   }
    │
    └── Initiates SSE Connection to E2B Sandbox
        ↓
    [E2B Sandbox]
        ├── Runs MCP Server (e.g., @modelcontextprotocol/server-brave-search)
        │
        ├── Exposes HTTP/SSE Endpoint
        │   (Acts as gateway between browser and MCP protocol)
        │
        └── Streams Tool Definitions and Results
```

### Implementation Details

**Location**: `/home/user/hackhaton/mcp-chat/src/hooks/useMcpTools.ts` (line 63-68)

```typescript
const aiClient = await experimental_createMCPClient({
  transport: {
    type: 'sse',
    url,  // From sandbox.getUrl()
  },
})
const tools = await aiClient.tools()
```

### Why SSE?

1. **Browser Compatibility**: Works in browsers (unlike WebSocket)
2. **Unidirectional**: Server → Client (suitable for streaming)
3. **Auto-reconnect**: Built-in reconnection mechanism
4. **No Firewall Issues**: Works over standard HTTP

### Tool Execution Flow

```
1. User sends message
   ↓
2. useChat merges all tools from running servers
   ↓
3. streamText() calls Anthropic/OpenAI with tools parameter
   ↓
4. Model decides to call a tool
   ↓
5. AI SDK serializes tool call
   ↓
6. Tool call sent back via SSE to E2B sandbox
   ↓
7. MCP server executes tool (e.g., API call, database query)
   ↓
8. Result streamed back to browser via SSE
   ↓
9. extractToolCalls() parses tool invocation and result
   ↓
10. Display in Chat UI with tool call details
```

---

## 7. CONFIGURATION FILES

### vite.config.ts
```typescript
{
  base: '/mcp-chat',        // GitHub Pages path
  plugins: [react()],       // React Fast Refresh
  resolve: {
    alias: { "@": "./src" } // Path alias
  }
}
```

### tailwind.config.ts
- Dark mode support via CSS class
- Custom color variables (HSL-based)
- ShadCN/ui preset colors
- Accordion animations
- Responsive breakpoints

### components.json (ShadCN/ui Config)
```json
{
  "style": "new-york",
  "rsc": true,
  "tailwind": {
    "config": "tailwind.config.ts",
    "css": "src/index.css",
    "baseColor": "zinc"
  },
  "aliases": {
    "components": "@/components",
    "utils": "@/lib/utils",
    "ui": "@/components/ui"
  }
}
```

### tsconfig.json
- Target: ES2020
- JSX: React JSX
- Module resolution: bundler
- Path alias: `@` → `./src`

### globals.css
- Tailwind directives
- CSS variable definitions for light/dark themes
- Base layer styling
- Color palette using HSL values

### GitHub Pages Deployment (.github/workflows/deploy.yml)

**Trigger**: Push to main branch
**Build Steps**:
1. Checkout code
2. Detect package manager (npm/yarn)
3. Setup Node.js LTS
4. Install dependencies
5. Build: `npm run build` → outputs to `./dist`
6. Upload artifact to GitHub Pages
7. Deploy automatically

**URL**: `https://netglade.github.io/mcp-chat`

---

## 8. DATA FLOW DIAGRAMS

### Chat Message Flow

```
User Input
    ↓
[ChatInput] → setChatInput (localStorage)
    ↓
Form Submit → addMessage(user message)
    ↓
[useChat.generateResponseAsync] ({messages})
    ├── Filter running clients
    ├── Extend/restart MCP servers
    ├── Merge all tools
    ├── Get model client (Anthropic/OpenAI)
    ├── Call streamText() with:
    │   ├── model
    │   ├── tools
    │   ├── messages (converted to AI SDK format)
    │   ├── maxSteps: 20 (for agentic loops)
    │   └── onChunk callback (streaming text)
    └── Extract tool calls from response
        ↓
[Chat Component] renders message + tool calls
    ├── Markdown render text
    ├── Expandable tool call sections
    └── Display tool arguments + results
```

### MCP Server Lifecycle

```
User adds server
    ↓
[ToolSettings Dialog]
    │   name: "Brave Search"
    │   command: "npx -y @modelcontextprotocol/server-brave-search"
    │   envs: { BRAVE_API_KEY: "..." }
    ↓
[useMcpTools.onAddServerAsync]
    ├── Create configuration with UUID
    ├── Update localStorage (mcpServerConfigurations)
    ├── Call startServer(configuration)
    │   ├── Set state: 'starting'
    │   ├── Call startMcpSandbox({
    │   │     command, apiKey, envs, timeout
    │   │   })
    │   ├── Poll for ready (6s × 5 = 30s max)
    │   ├── Create MCP client via Vercel AI SDK
    │   ├── Fetch tools: aiClient.tools()
    │   ├── Set state: 'running'
    │   └── Store sandbox, url, client, tools
    └── Error handling → state: 'error'
        ↓
Server available in chat tools
    ↓
Model can call tools from this server
```

### Message Type Conversion

```
Internal Message Type:
{
  role: 'user' | 'assistant'
  content: [
    { type: 'text', text: '...' } |
    { type: 'code', text: '...' } |
    { type: 'image', image: '...' }
  ]
  toolCalls?: ToolCall[]
}
    ↓
toAISDKMessages() conversion
    ↓
AI SDK CoreMessage:
{
  role: 'user' | 'assistant'
  content: [
    { type: 'text', text: '...' } |
    { type: 'tool-result', toolCallId: '...', result: '...' }
  ]
}
```

---

## 9. KEY TECHNICAL PATTERNS

### Pattern 1: Local Storage Persistence
```typescript
const [value, setValue] = useLocalStorage('key', defaultValue)
```
Used for:
- Chat input (recovery on page refresh)
- API keys (convenience, NOT secure for production)
- Model configuration
- Theme preference

**Security Note**: API keys stored in localStorage are accessible via JavaScript. Use environment variables or secure storage for production.

### Pattern 2: State Management with Immer
```typescript
import { produce } from 'immer'

// Immutable update
setServerClients(produce((draft) => {
  const client = draft.find(c => c.id === id)
  if (client) client.state = 'running'
}))
```

### Pattern 3: React Query Mutations
```typescript
const { mutateAsync, isPending } = useMutation({
  mutationFn: async (args) => { /* ... */ }
})

// Trigger
await mutateAsync(args)
```

### Pattern 4: Streaming with AI SDK
```typescript
const result = streamText({
  model,
  tools,
  onChunk: ({ chunk }) => {
    if (chunk.type === 'text-delta') {
      accumulatedText += chunk.textDelta
      onStreamUpdate?.(accumulatedText)
    }
  }
})

// Wait for completion
for await (const part of result.fullStream) {
  if (part.type === 'finish') break
}
```

### Pattern 5: Responsive Layout
```typescript
<div className="grid w-full md:grid-cols-2 relative">
  {/* Left panel: TutorialCard (hidden on mobile) */}
  <TutorialCard />
  {/* Right panel: Chat (always visible) */}
  <div className="col-span-2 md:col-span-1">
    {/* Chat UI */}
  </div>
</div>
```

---

## 10. REPLICATION CHECKLIST FOR NEW PROJECTS

To replicate this architecture for a different use case:

- [ ] **Setup**: `npm install` + configure env variables
- [ ] **E2B Integration**: Add E2B API key, understand sandbox lifecycle
- [ ] **MCP Servers**: Define presets and server configurations
- [ ] **LLM Providers**: Configure Anthropic/OpenAI API clients
- [ ] **State Management**: Implement useLocalStorage for persistence
- [ ] **React Hooks**: Create custom hooks for domain logic (useChat, useMcpTools)
- [ ] **Components**: Build React component tree with Radix UI + ShadCN
- [ ] **Styling**: Configure Tailwind CSS with dark mode
- [ ] **Streaming**: Implement real-time streaming via AI SDK
- [ ] **Error Handling**: Add error boundaries and user-friendly messages
- [ ] **Deployment**: Set up GitHub Pages or other hosting

---

## 11. IMPORTANT URLS & REFERENCES

- **Live Demo**: https://netglade.github.io/mcp-chat/
- **Repository**: https://github.com/netglade/mcp-chat
- **Blog Post**: https://www.netglade.cz/en/blog/bringing-mcps-to-the-cloud-how-we-won-the-e2b-hackathon
- **MCP Servers**: https://github.com/modelcontextprotocol/servers
- **E2B Docs**: https://e2b.dev
- **Vercel AI SDK**: https://github.com/vercel/ai

---

## 12. CRITICAL IMPLEMENTATION DETAILS

### Browser Direct Access Header
```typescript
headers: {
  'anthropic-dangerous-direct-browser-access': 'true',
}
```
**Purpose**: Allow Anthropic API calls from browser (normally not recommended)
**Risk**: API key exposed to client-side, but acceptable for demo/educational purposes

### Tool Call Parsing
Located in `/home/user/hackhaton/mcp-chat/src/hooks/useChat.ts` (lines 89-144)

- Iterates through AI SDK response messages
- Finds `tool-call` content items
- Matches with corresponding `tool-result` messages
- Extracts arguments and results
- Converts to display format

### Server Readiness Polling
- Polls endpoint every 6 seconds
- Maximum 5 attempts = 30 second timeout
- Implements simple backoff strategy
- Throws error if server never becomes ready

### Tool Merging
```typescript
let tools = {}
for (const client of runningClients) {
  tools = { ...tools, ...client.tools }
}
```
All tools from all servers combined into single object for model

---

## Summary

MCP Chat demonstrates a production-ready pattern for:

1. **Browser-based MCP execution** via E2B sandboxes
2. **Real-time tool execution** with streaming responses
3. **Multi-tool orchestration** (merging tools from multiple sources)
4. **Modern React architecture** with hooks and state management
5. **SSE-based communication** between browser and cloud servers
6. **Responsive UI** with dark mode and accessibility
7. **Secure credential handling** (though localStorage is used for demo)

The architecture is highly replicable for similar projects requiring:
- Sandbox execution in the browser
- Tool/plugin integration
- Streaming AI responses
- Multi-service orchestration

