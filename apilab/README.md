# APILab 🧪

AI-powered API testing tool - like Postman, but with natural language. Built with React, Vercel AI SDK, and E2B MCP servers.

## Features

- 🤖 **AI-Powered API Testing**: Just describe what API you want to test in plain English
- 🔧 **MCP Tool Integration**: Search with DuckDuckGo, ArXiv papers, and more
- ⚡ **Real-time Streaming**: See AI responses and tool executions in real-time
- 🎨 **Visual Feedback**: Clear indicators for AI thinking, tool preparation, and execution
- 🌐 **Multi-Provider**: Supports Neosantara AI (Indonesian LLM) and Groq

## Architecture

APILab uses a **backend proxy architecture** to run MCP servers securely:

```
┌─────────────┐     ┌──────────────────┐     ┌─────────────┐
│   Frontend  │────▶│     Backend      │────▶│  E2B MCP    │
│  (Browser)  │     │ (Cloudflare      │     │  Sandbox    │
│             │     │   Worker)        │     │             │
└─────────────┘     └──────────────────┘     └─────────────┘
```

- **Frontend**: React + Vite + Vercel AI SDK
- **Backend**: Cloudflare Worker that proxies MCP requests via JSON-RPC over HTTP
- **E2B Sandbox**: Secure sandbox running MCP servers (DuckDuckGo, ArXiv, etc.)

## Quick Start

### Prerequisites

- Node.js 18+
- npm or pnpm
- API Keys:
  - [E2B API Key](https://e2b.dev) (Required)
  - [Neosantara API Key](https://api.neosantara.xyz) or [Groq API Key](https://console.groq.com) (Required)

### Installation

1. **Clone and install dependencies**:
```bash
git clone <repo-url>
cd apilab
npm install
cd worker && pnpm install && cd ..
```

2. **Start the backend worker**:
```bash
npm run dev:worker
```

The Cloudflare Worker will start on `http://localhost:8787` with these endpoints:
- `POST /api/mcp/init` - Create E2B sandbox
- `GET /api/mcp/tools/:sandboxId` - List available tools
- `POST /api/mcp/call/:sandboxId` - Execute tool
- `GET /api/mcp/sandbox/:sandboxId` - Get sandbox info
- `GET /health` - Health check

3. **Start the frontend** (in a new terminal):
```bash
npm run dev
```

The frontend will start on `http://localhost:5173`

4. **Configure API keys**:
   - Open the app in your browser
   - Click the Settings (⚙️) button
   - Add your API keys:
     - **Backend API URL**: `http://localhost:8787` (auto-filled)
     - **E2B API Key**: Your E2B sandbox key
     - **Neosantara AI** or **Groq**: Your LLM provider key

### Development Scripts

```bash
# Run only frontend
npm run dev

# Run only backend (Cloudflare Worker)
npm run dev:worker

# Build for production
npm run build

# Deploy worker to Cloudflare
npm run deploy:worker
```

## Usage Examples

Once configured, you can test APIs using natural language:

1. **Search the web**:
   ```
   "Search for latest AI news"
   "Find information about TypeScript 5.0"
   ```

2. **Research papers**:
   ```
   "Look up machine learning papers"
   "Find recent papers about transformers"
   ```

3. **More coming soon**:
   - HTTP request tools
   - Database query tools
   - Custom MCP servers

## How It Works

### 1. AI Planning Phase
When you send a message, the AI (powered by Neosantara or Groq) decides which tools to call.

**UI Feedback**: 🟣 Purple "Thinking about which tools to call..."

### 2. Tool Preparation Phase
AI streams the tool call arguments (progressive).

**UI Feedback**: 🔵 Blue "Preparing tool call..." with animated dots

### 3. Tool Execution Phase
Backend proxies the request to E2B MCP sandbox and executes the tool.

**UI Feedback**: 🔵 Blue "Executing API call..." with args visible

### 4. Result Presentation
AI receives the results and summarizes them for you.

**UI Feedback**: 🟢 Green with expandable result JSON

## Key Technologies

- **[Vercel AI SDK](https://ai-sdk.dev)**: Unified AI interface with streaming support
- **[E2B Sandboxes](https://e2b.dev)**: Secure execution environment for MCP servers
- **[Model Context Protocol (MCP)](https://modelcontextprotocol.io)**: Standard for tool calling
- **React 19**: Modern React with hooks
- **TypeScript**: Type-safe development
- **Tailwind CSS**: Utility-first styling
- **shadcn/ui**: Beautiful UI components

## Project Structure

```
apilab/
├── src/
│   ├── components/     # UI components
│   │   ├── ChatMessage.tsx
│   │   ├── ToolExecutionCard.tsx
│   │   ├── Settings.tsx
│   │   └── ...
│   ├── hooks/         # React hooks
│   │   ├── useApiChat.ts      # Chat management
│   │   ├── useMcpTools.ts     # MCP integration
│   │   └── useLocalStorage.ts # Settings persistence
│   ├── lib/           # Core libraries
│   │   └── groq-client.ts     # AI SDK wrapper
│   └── App.tsx        # Main app component
├── worker/
│   ├── index.ts       # Cloudflare Worker backend
│   ├── wrangler.toml  # Wrangler configuration
│   └── package.json
└── package.json       # Frontend dependencies
```

## Troubleshooting

### "Failed to fetch" Error

**Problem**: Frontend can't connect to backend.

**Solution**: Make sure the Cloudflare Worker is running:
```bash
cd worker
pnpm wrangler dev --port 8787
```

Or from root:
```bash
npm run dev:worker
```

Check that `http://localhost:8787/health` returns `{"status": "ok"}`.

### "E2B API key not found"

**Problem**: E2B key not configured.

**Solution**:
1. Get API key from [e2b.dev](https://e2b.dev)
2. Open Settings in the app
3. Add your E2B API key

### "No LLM provider configured"

**Problem**: Neither Neosantara nor Groq API key is set.

**Solution**: Add at least one LLM provider key in Settings:
- Neosantara: Indonesian language model (Primary)
- Groq: Fast inference with Llama 3.1 (Alternative)

### Tool execution fails

**Problem**: MCP sandbox creation or tool call fails.

**Common causes**:
- Invalid E2B API key
- E2B quota exceeded
- Network issues

**Solution**: Check browser console for detailed error messages.

## Deployment

### Frontend (Cloudflare Pages / Vercel / Netlify)

```bash
npm run build
# Deploy the `dist/` directory
```

### Backend (Cloudflare Workers)

```bash
npm run deploy:worker
```

Or deploy to any Node.js hosting platform (Railway, Render, Fly.io, etc.)

**Important**: Update `backendUrl` in Settings to point to your deployed backend URL.

## Contributing

Contributions welcome! Please open issues or PRs.

## License

MIT

## Support

For issues or questions:
- Open an issue on GitHub
- Check browser console for detailed error logs
- Enable "Copy Error" button to share error details
