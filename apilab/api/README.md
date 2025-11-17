# APILab Backend Server

Backend API server untuk handle E2B MCP sandbox creation (Node.js operations yang tidak bisa run di browser).

## 🎯 Purpose

Package `e2b` require Node.js APIs (`fs`, `crypto`, `path`) yang tidak tersedia di browser. Backend ini handle:
- E2B sandbox creation dengan `Sandbox.betaCreate()`
- Return `mcpUrl` + `mcpToken` ke frontend
- Frontend connect via browser-compatible MCP SDK

## 📦 Installation

```bash
cd api
bun install
```

## 🚀 Running the Server

```bash
# Development mode
bun run dev

# Production mode
bun run start
```

Server akan running di `http://localhost:3001`

## 🔌 API Endpoints

### `POST /api/mcp/init`

Create E2B sandbox with MCP gateway.

**Request Body:**
```json
{
  "apiKey": "e2b_***",
  "mcpServers": {
    "duckduckgo": {},
    "arxiv": { "storagePath": "/" }
  }
}
```

**Response:**
```json
{
  "sandboxId": "xxx",
  "mcpUrl": "https://xxx.e2b.dev/mcp",
  "mcpToken": "Bearer ***"
}
```

### `GET /api/mcp/sandbox/:sandboxId`

Get sandbox status.

**Response:**
```json
{
  "sandboxId": "xxx",
  "isRunning": true,
  "url": "https://xxx.e2b.dev/mcp"
}
```

### `GET /health`

Health check endpoint.

**Response:**
```json
{
  "status": "ok",
  "timestamp": "2025-11-17T..."
}
```

## 🔧 Environment Variables

None required - API key dikirim dari frontend via request body.

## 🏗️ Architecture

```
┌─────────────────┐         ┌──────────────────┐         ┌──────────────┐
│   Browser       │  HTTP   │  Backend Server  │  E2B    │  E2B Cloud   │
│   (Frontend)    │ ────▶   │  (Bun/Node.js)   │  SDK    │  (MCP)       │
│                 │ ◀────   │  Port 3001       │ ────▶   │              │
└─────────────────┘  JSON   └──────────────────┘         └──────────────┘
    │                                                              │
    └──────────────────────────────────────────────────────────────┘
          Connect via MCP SDK (browser-compatible SSE)
```

## 📝 Notes

- Server menggunakan in-memory cache untuk sandboxes (untuk production, gunakan Redis/DB)
- CORS enabled untuk development (configure untuk production)
- E2B sandboxes have 10-minute timeout by default
