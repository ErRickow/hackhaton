#!/usr/bin/env node

/**
 * HTTP Client MCP Server
 * Provides HTTP request capabilities to AI agents via MCP protocol
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  Tool,
} from '@modelcontextprotocol/sdk/types.js';
import fetch, { Headers as FetchHeaders, RequestInit } from 'node-fetch';

// In-memory state for auth headers
const authHeaders: Record<string, string> = {};

// Define available tools
const TOOLS: Tool[] = [
  {
    name: 'make_http_request',
    description: 'Make an HTTP request to any API endpoint. Supports GET, POST, PUT, DELETE, PATCH methods.',
    inputSchema: {
      type: 'object',
      properties: {
        url: {
          type: 'string',
          description: 'The full URL to make the request to (e.g., https://api.example.com/data)',
        },
        method: {
          type: 'string',
          enum: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
          description: 'HTTP method to use',
          default: 'GET',
        },
        headers: {
          type: 'object',
          description: 'Optional HTTP headers as key-value pairs',
          additionalProperties: { type: 'string' },
        },
        body: {
          type: 'string',
          description: 'Request body (for POST, PUT, PATCH). Will be sent as-is. For JSON, stringify first.',
        },
        query: {
          type: 'object',
          description: 'Optional query parameters as key-value pairs',
          additionalProperties: { type: 'string' },
        },
      },
      required: ['url'],
    },
  },
  {
    name: 'set_bearer_token',
    description: 'Set a Bearer token for authentication. This will be included in all subsequent requests.',
    inputSchema: {
      type: 'object',
      properties: {
        token: {
          type: 'string',
          description: 'The Bearer token to use for authentication',
        },
      },
      required: ['token'],
    },
  },
  {
    name: 'set_api_key',
    description: 'Set a custom API key header. This will be included in all subsequent requests.',
    inputSchema: {
      type: 'object',
      properties: {
        key: {
          type: 'string',
          description: 'The API key value',
        },
        headerName: {
          type: 'string',
          description: 'The header name to use (e.g., "X-API-Key", "api-key")',
          default: 'X-API-Key',
        },
      },
      required: ['key'],
    },
  },
  {
    name: 'clear_auth',
    description: 'Clear all stored authentication headers',
    inputSchema: {
      type: 'object',
      properties: {},
    },
  },
];

// Create MCP server instance
const server = new Server(
  {
    name: 'http-client-mcp',
    version: '0.1.0',
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

// Handler: List available tools
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return { tools: TOOLS };
});

// Handler: Execute tool calls
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    switch (name) {
      case 'make_http_request': {
        const {
          url,
          method = 'GET',
          headers = {},
          body,
          query = {},
        } = args as {
          url: string;
          method?: string;
          headers?: Record<string, string>;
          body?: string;
          query?: Record<string, string>;
        };

        // Build URL with query params
        const urlObj = new URL(url);
        Object.entries(query).forEach(([key, value]) => {
          urlObj.searchParams.append(key, value);
        });

        // Merge custom headers with auth headers
        const allHeaders = new FetchHeaders({
          ...authHeaders,
          ...headers,
        });

        // Make the request
        const fetchOptions: RequestInit = {
          method,
          headers: allHeaders,
        };

        if (body && ['POST', 'PUT', 'PATCH'].includes(method.toUpperCase())) {
          fetchOptions.body = body;
        }

        const startTime = Date.now();
        const response = await fetch(urlObj.toString(), fetchOptions);
        const endTime = Date.now();

        // Get response body
        const contentType = response.headers.get('content-type') || '';
        let responseBody: any;

        if (contentType.includes('application/json')) {
          responseBody = await response.json();
        } else {
          responseBody = await response.text();
        }

        // Build response object
        const result = {
          status: response.status,
          statusText: response.statusText,
          headers: Object.fromEntries(response.headers.entries()),
          body: responseBody,
          timing: {
            duration: endTime - startTime,
            unit: 'ms',
          },
          url: urlObj.toString(),
          method,
        };

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(result, null, 2),
            },
          ],
        };
      }

      case 'set_bearer_token': {
        const { token } = args as { token: string };
        authHeaders['Authorization'] = `Bearer ${token}`;

        return {
          content: [
            {
              type: 'text',
              text: '✓ Bearer token set successfully. It will be included in all subsequent requests.',
            },
          ],
        };
      }

      case 'set_api_key': {
        const { key, headerName = 'X-API-Key' } = args as {
          key: string;
          headerName?: string;
        };
        authHeaders[headerName] = key;

        return {
          content: [
            {
              type: 'text',
              text: `✓ API key set successfully in header "${headerName}". It will be included in all subsequent requests.`,
            },
          ],
        };
      }

      case 'clear_auth': {
        Object.keys(authHeaders).forEach(key => delete authHeaders[key]);

        return {
          content: [
            {
              type: 'text',
              text: '✓ All authentication headers cleared.',
            },
          ],
        };
      }

      default:
        throw new Error(`Unknown tool: ${name}`);
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    return {
      content: [
        {
          type: 'text',
          text: `Error: ${errorMessage}`,
        },
      ],
      isError: true,
    };
  }
});

// Start the server
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);

  // Log to stderr so it doesn't interfere with MCP protocol on stdout
  console.error('HTTP Client MCP Server running on stdio');
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
