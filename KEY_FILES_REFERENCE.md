# MCP Chat - Key Files Quick Reference

## Core Entry Points

### /home/user/hackhaton/mcp-chat/src/main.tsx
**Purpose**: React application bootstrap and provider setup
**Key Elements**:
- QueryClient for TanStack React Query
- ThemeProvider for dark/light mode
- Root React render call
- QueryClient default staleTime: 60s

### /home/user/hackhaton/mcp-chat/src/App.tsx
**Purpose**: Root component with main state management
**Key Elements**:
- Message state (useState)
- Chat input persistence (useLocalStorage)
- LLM model configuration (useLocalStorage)
- E2B API key (useLocalStorage)
- useChat and useMcpTools hooks
- Conditional rendering (SetupGuide vs Chat)

**File Size**: ~189 lines
**Key Functions**: handleSubmit, retry, addMessage, handleClearChat

---

## Hooks (Business Logic)

### /home/user/hackhaton/mcp-chat/src/hooks/useMcpTools.ts
**Purpose**: Manage MCP server lifecycle and sandbox connections
**File Size**: ~207 lines

**Key Functions**:
- `startServer(configuration)` - Launch MCP server in E2B
- `extendOrRestartServer(client)` - Keep sandbox alive or restart
- `waitForServerReady(url, maxAttempts)` - Poll for server readiness
- `onAddServerAsync` - React Query mutation for adding servers
- `onRemoveServerAsync` - React Query mutation for removing servers

**Key State**:
- serverConfigurations (persisted in localStorage)
- serverClients (running instances with state)

**Critical Implementation**:
- 6-second polling intervals with 5 max attempts (30s timeout)
- 300,000ms (5 minutes) sandbox timeout
- Immer for immutable state updates

### /home/user/hackhaton/mcp-chat/src/hooks/useChat.ts
**Purpose**: Handle chat message generation with streaming
**File Size**: ~145 lines

**Key Functions**:
- `generateResponseFn({messages})` - Main async chat function
- `extractToolCalls(conversation)` - Parse AI SDK messages for tool invocations

**Key Features**:
- Merges tools from all running MCP servers
- Uses `streamText()` from Vercel AI SDK
- maxSteps: 20 for agentic looping
- Real-time streaming via onChunk callbacks
- Extracts tool calls and results from response

---

## Type Definitions

### /home/user/hackhaton/mcp-chat/src/types/mcpServer.ts
```typescript
type McpServerState = 'starting' | 'running' | 'error'
type McpServerConfiguration = {
  name: string
  command: string
  envs: Record<string, string>
  id: string
}
type McpServerClient = {
  id: string
  configuration: McpServerConfiguration
  state: McpServerState
  sandbox?: McpSandbox
  url?: string
  client?: ExperimentalMCPClient
  tools?: Record<string, Tool>
}
```

### /home/user/hackhaton/mcp-chat/src/types/message.ts
```typescript
type MessageText = { type: 'text', text: string }
type MessageCode = { type: 'code', text: string }
type MessageImage = { type: 'image', image: string }
type Message = {
  role: 'assistant' | 'user'
  content: Array<MessageText | MessageCode | MessageImage>
  toolCalls?: ToolCall[]
}
```

### /home/user/hackhaton/mcp-chat/src/types/llmModel.ts
```typescript
type LLMModel = {
  id: string
  name: string
  provider: string
  providerId: string
}
type LLMModelConfig = {
  model?: string
  apiKey?: string
  baseURL?: string
  temperature?: number
  topP?: number
  topK?: number
  frequencyPenalty?: number
  presencePenalty?: number
  maxTokens?: number
}
```

### /home/user/hackhaton/mcp-chat/src/types/toolCall.ts
```typescript
type ToolCallArgument = { name: string, value: string }
type ToolCall = {
  name: string
  arguments: ToolCallArgument[]
  result: string
  id: string
}
```

---

## UI Components

### /home/user/hackhaton/mcp-chat/src/components/Chat.tsx
**Purpose**: Render message history with tool invocations
**File Size**: ~150+ lines
**Key Features**:
- Scrollable container with auto-scroll to bottom
- Tool call expansion/collapse
- Markdown rendering with remark-gfm
- Streaming text updates via streamingContent prop
- Different styling for user/assistant messages
- Setup guide or empty state when no messages

### /home/user/hackhaton/mcp-chat/src/components/ChatInput.tsx
**Purpose**: Message input form with settings toolbar
**File Size**: ~80+ lines
**Key Features**:
- Auto-expanding textarea
- Enter to send, Shift+Enter for newline
- Floating toolbar buttons (Settings, API Keys, Model Picker)
- Spinner during loading
- Form validation

### /home/user/hackhaton/mcp-chat/src/components/ToolSettings.tsx
**Purpose**: MCP server management interface
**File Size**: ~411 lines (largest component)
**Key Features**:
- Dropdown menu with server list
- Add/remove server dialogs
- Environment variable input
- Quick-start presets
- Server status indicators (green/red dots)
- Active server count badge

### /home/user/hackhaton/mcp-chat/src/components/ApiKeySettings.tsx
**Purpose**: API key configuration
**File Size**: ~92 lines
**Key Features**:
- Separate inputs for E2B and model API keys
- Password masking
- Incomplete setup indicator (red dot)
- Clear labeling of required keys

### /home/user/hackhaton/mcp-chat/src/components/ModelPicker.tsx
**Purpose**: Select LLM provider and model
**File Size**: ~61 lines
**Key Features**:
- Radix UI Select component
- Grouped by provider (OpenAI, Anthropic)
- Provider logos from assets
- Default value from config

### /home/user/hackhaton/mcp-chat/src/components/TutorialCard.tsx
**Purpose**: Info panel (visible on XL screens)
**File Size**: ~80+ lines
**Key Features**:
- About MCP section
- Resource links
- Privacy/security notice
- Contact information
- Accordion-based layout

### /home/user/hackhaton/mcp-chat/src/components/SetupGuide.tsx
**Purpose**: Initial setup instructions
**File Size**: ~48 lines
**Key Features**:
- Step-by-step setup
- Visual checkmarks for completed steps
- Icon reference to settings
- Links to external resources

### /home/user/hackhaton/mcp-chat/src/components/EmptyState.tsx
**Purpose**: Initial state with example queries
**File Size**: ~65 lines
**Key Features**:
- Example query cards (Postgres, Brave Search, GitHub, E2B Calculator)
- Icons for each example
- Click handlers to populate chat input

### Other Components
- **NavBar.tsx**: Title + clear button + GitHub link + theme toggle
- **ErrorMessage.tsx**: Error display with retry button
- **Footer.tsx**: Links and attribution
- **ThemeProvider.tsx**: Dark/light mode context

---

## Utilities & Configuration

### /home/user/hackhaton/mcp-chat/src/lib/models.ts
**Purpose**: Factory for creating LLM client instances
```typescript
function getModelClient(model: LLMModel, config: LLMModelConfig)
```
- Creates Anthropic or OpenAI client based on provider
- Supports custom baseURL
- Disables structured outputs for OpenAI

### /home/user/hackhaton/mcp-chat/src/lib/messages.ts
**Purpose**: Convert internal message format to AI SDK format
```typescript
function toAISDKMessages(messages: Message[])
```
- Converts `code` type to `text` type
- Maintains message structure for AI SDK

### /home/user/hackhaton/mcp-chat/src/lib/utils.ts
**Purpose**: Utility functions
```typescript
function cn(...inputs: ClassValue[])
```
- Combines clsx + tailwind-merge
- Used for className merging with Tailwind

### /home/user/hackhaton/mcp-chat/src/lib/models.json
**Purpose**: List of supported LLM models
**Contents**: 8 models (OpenAI: o1, o3-mini, gpt-4.5, gpt-4o, gpt-4o-mini; Anthropic: Claude variants)

### /home/user/hackhaton/mcp-chat/src/lib/presets.json
**Purpose**: Quick-start MCP server templates
**Contents**: 4 presets (Brave Search, E2B Interpreter, GitHub, PostgreSQL)

---

## Configuration Files

### /home/user/hackhaton/mcp-chat/vite.config.ts
```typescript
export default defineConfig({
  plugins: [react()],
  base: '/mcp-chat',  // GitHub Pages path
  resolve: {
    alias: { "@": path.resolve(__dirname, "./src") }
  }
})
```

### /home/user/hackhaton/mcp-chat/tailwind.config.ts
- Dark mode: class-based
- Colors: Radix UI + ShadCN preset (zinc)
- Animations: accordion transitions
- CSS variables: HSL-based theme colors

### /home/user/hackhaton/mcp-chat/components.json (ShadCN/ui config)
- Style: "new-york"
- Base color: "zinc"
- Aliases for components, utils, lib, hooks
- Icon library: lucide

### /home/user/hackhaton/mcp-chat/tsconfig.json
- Target: ES2020
- JSX: react-jsx
- Module: esnext
- Strict: true
- Path alias: @

### /home/user/hackhaton/mcp-chat/src/globals.css
- Tailwind directives (@tailwind base, components, utilities)
- CSS variable definitions for light/dark themes
- HSL-based color palette
- Body background and foreground colors

---

## Styling

### /home/user/hackhaton/mcp-chat/src/globals.css
**CSS Variables (Light Mode)**:
- --background: 0 0% 100% (white)
- --foreground: 240 10% 3.9% (dark gray)
- --primary: 240 5.9% 10% (nearly black)
- --destructive: 0 84.2% 60.2% (red)
- --border: 240 5.9% 90% (light gray)

**CSS Variables (Dark Mode)**:
- --background: 240, 6%, 10% (dark gray)
- --foreground: 0 0% 98% (off-white)
- --primary: 0 0% 98% (white)
- --destructive: 0 62.8% 30.6% (darker red)

---

## Deployment

### /home/user/hackhaton/mcp-chat/.github/workflows/deploy.yml
**Trigger**: Push to main branch
**Steps**:
1. Checkout code
2. Detect package manager (npm/yarn)
3. Setup Node.js LTS
4. Install dependencies
5. Build: npm run build → dist/
6. Upload artifact
7. Deploy to GitHub Pages

---

## Important Code Patterns

### Local Storage Pattern
```typescript
const [value, setValue] = useLocalStorage('key', defaultValue)
// Automatically persists to localStorage on every change
```

### React Query Mutation Pattern
```typescript
const { mutateAsync, isPending } = useMutation({
  mutationFn: async (args) => { /* ... */ }
})
await mutateAsync(args)
```

### Immer State Update Pattern
```typescript
setState(produce((draft) => {
  // Modify draft directly, returns immutable update
}))
```

### Streaming Pattern
```typescript
const result = streamText({
  model,
  tools,
  onChunk: ({ chunk }) => {
    if (chunk.type === 'text-delta') {
      accumulatedText += chunk.textDelta
    }
  }
})
for await (const part of result.fullStream) {
  if (part.type === 'finish') break
}
```

---

## Critical Implementation Details

### E2B Sandbox Timeout
- Initial: 300,000ms (5 minutes)
- Extended per request: 300,000ms
- Polling: 6-second intervals, 5 attempts max

### Server Readiness Poll
```typescript
async function waitForServerReady(url: string, maxAttempts = 5) {
  for (let i = 0; i < maxAttempts; i++) {
    try {
      const response = await fetch(url)
      if (response.status === 200) return true
    } catch { /* ... */ }
    await new Promise(resolve => setTimeout(resolve, 6000))
  }
  return false
}
```

### Tool Merging
```typescript
let tools = {}
for (const client of runningClients) {
  tools = { ...tools, ...client.tools }
}
```

### Browser Direct Access Header
```typescript
headers: {
  'anthropic-dangerous-direct-browser-access': 'true',
}
```

---

## File Size Overview

| File | Lines | Purpose |
|------|-------|---------|
| App.tsx | 189 | Root component |
| useMcpTools.ts | 207 | MCP lifecycle |
| useChat.ts | 145 | Chat logic |
| ToolSettings.tsx | 411 | Server management |
| Chat.tsx | 150+ | Message display |
| ChatInput.tsx | 80+ | Input form |
| ApiKeySettings.tsx | 92 | API key config |
| others | < 100 | UI components |

