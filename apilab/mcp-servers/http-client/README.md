# HTTP Client MCP Server

A Model Context Protocol (MCP) server that provides HTTP request capabilities to AI agents.

## Features

- **Make HTTP Requests**: GET, POST, PUT, DELETE, PATCH
- **Authentication**: Bearer tokens and custom API keys
- **Headers**: Custom headers support
- **Query Parameters**: URL query string building
- **Response Handling**: JSON and text responses
- **Timing Info**: Request duration tracking

## Tools Available

### 1. `make_http_request`

Make an HTTP request to any API endpoint.

**Parameters:**
- `url` (required): Full URL to request
- `method` (optional): HTTP method (default: GET)
- `headers` (optional): Custom headers object
- `body` (optional): Request body string
- `query` (optional): Query parameters object

**Example:**
```json
{
  "url": "https://api.coingecko.com/api/v3/simple/price",
  "method": "GET",
  "query": {
    "ids": "bitcoin",
    "vs_currencies": "usd"
  }
}
```

### 2. `set_bearer_token`

Set a Bearer token for authentication in all subsequent requests.

**Parameters:**
- `token` (required): Bearer token value

### 3. `set_api_key`

Set a custom API key header for all subsequent requests.

**Parameters:**
- `key` (required): API key value
- `headerName` (optional): Header name (default: "X-API-Key")

### 4. `clear_auth`

Clear all stored authentication headers.

## Usage

### Running Locally

```bash
npm install
npm run build
npm start
```

### Running in E2B Sandbox

```typescript
import { startMcpSandbox } from '@netglade/mcp-sandbox';

const mcp = await startMcpSandbox({
  command: 'npx -y @apilab/http-client-mcp',
  apiKey: process.env.E2B_API_KEY,
});

// Get available tools
const tools = await mcp.getTools();

// Make an API request
const result = await mcp.callTool('make_http_request', {
  url: 'https://api.github.com/zen',
  method: 'GET',
});
```

### With Vercel AI SDK

```typescript
import { experimental_createMCPClient as createMCPClient } from 'ai';

const mcpClient = createMCPClient({
  url: mcp.getUrl(), // URL from E2B sandbox
  transport: 'sse',
});

const tools = await mcpClient.getTools();
```

## Development

```bash
# Install dependencies
npm install

# Build TypeScript
npm run build

# Watch mode
npm run dev
```

## Response Format

Successful requests return:
```json
{
  "status": 200,
  "statusText": "OK",
  "headers": { ... },
  "body": { ... },
  "timing": {
    "duration": 145,
    "unit": "ms"
  },
  "url": "https://...",
  "method": "GET"
}
```

## Error Handling

Errors are returned as MCP error responses:
```json
{
  "content": [{
    "type": "text",
    "text": "Error: Failed to fetch..."
  }],
  "isError": true
}
```

## License

MIT
