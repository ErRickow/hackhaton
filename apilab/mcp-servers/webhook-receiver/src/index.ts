#!/usr/bin/env node

/**
 * Webhook Receiver MCP Server
 * Receives webhooks in E2B sandbox and exposes them via MCP tools
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import express from 'express';
import bodyParser from 'body-parser';
import cors from 'cors';

// In-memory storage for webhook events
interface WebhookEvent {
  id: string;
  timestamp: string;
  method: string;
  path: string;
  headers: Record<string, string | string[] | undefined>;
  query: Record<string, any>;
  body: any;
  ip: string;
}

const webhookEvents: WebhookEvent[] = [];
let webhookServer: any = null;
let webhookPort: number = 3000;
let webhookUrl: string = '';

/**
 * Start Express server for receiving webhooks
 */
function startWebhookServer(port: number = 3000): Promise<string> {
  return new Promise((resolve, reject) => {
    if (webhookServer) {
      resolve(webhookUrl);
      return;
    }

    const app = express();

    // Middleware
    app.use(cors());
    app.use(bodyParser.json({ limit: '10mb' }));
    app.use(bodyParser.urlencoded({ extended: true, limit: '10mb' }));
    app.use(bodyParser.raw({ type: '*/*', limit: '10mb' }));

    // Webhook endpoint - accepts all methods
    app.all('/webhook', (req, res) => {
      console.log(`📨 Webhook received: ${req.method} ${req.path}`);

      const event: WebhookEvent = {
        id: `evt_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        timestamp: new Date().toISOString(),
        method: req.method,
        path: req.path,
        headers: req.headers as Record<string, string | string[] | undefined>,
        query: req.query,
        body: req.body,
        ip: req.ip || req.socket.remoteAddress || 'unknown',
      };

      webhookEvents.push(event);
      console.log(`✓ Event stored (${webhookEvents.length} total)`);

      // Send success response
      res.status(200).json({
        success: true,
        message: 'Webhook received',
        eventId: event.id,
      });
    });

    // Health check endpoint
    app.get('/health', (req, res) => {
      res.json({
        status: 'ok',
        eventsReceived: webhookEvents.length,
        uptime: process.uptime(),
      });
    });

    // Catch-all for other paths (also webhook)
    app.all('*', (req, res) => {
      console.log(`📨 Webhook received (catch-all): ${req.method} ${req.path}`);

      const event: WebhookEvent = {
        id: `evt_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        timestamp: new Date().toISOString(),
        method: req.method,
        path: req.path,
        headers: req.headers as Record<string, string | string[] | undefined>,
        query: req.query,
        body: req.body,
        ip: req.ip || req.socket.remoteAddress || 'unknown',
      };

      webhookEvents.push(event);
      console.log(`✓ Event stored (${webhookEvents.length} total)`);

      res.status(200).json({
        success: true,
        message: 'Webhook received',
        eventId: event.id,
      });
    });

    webhookServer = app.listen(port, () => {
      webhookPort = port;

      // In E2B, the URL will be exposed via HTTPS
      // For now, we use localhost
      webhookUrl = `http://localhost:${port}/webhook`;

      console.log(`🚀 Webhook server started on port ${port}`);
      console.log(`📍 Webhook URL: ${webhookUrl}`);
      console.log(`💡 In E2B sandbox, this will be exposed as HTTPS URL`);

      resolve(webhookUrl);
    });

    webhookServer.on('error', (err: Error) => {
      console.error('❌ Failed to start webhook server:', err);
      reject(err);
    });
  });
}

/**
 * MCP Server
 */
const server = new Server(
  {
    name: 'webhook-receiver',
    version: '0.1.0',
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

// List available tools
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: 'start_webhook_server',
        description: 'Start the webhook server and get the webhook URL. In E2B sandbox, this will be exposed as a public HTTPS URL.',
        inputSchema: {
          type: 'object',
          properties: {
            port: {
              type: 'number',
              description: 'Port to listen on (default: 3000)',
              default: 3000,
            },
          },
        },
      },
      {
        name: 'get_webhook_url',
        description: 'Get the webhook URL where events will be received',
        inputSchema: {
          type: 'object',
          properties: {},
        },
      },
      {
        name: 'get_events',
        description: 'Get all received webhook events',
        inputSchema: {
          type: 'object',
          properties: {
            limit: {
              type: 'number',
              description: 'Maximum number of events to return (default: all)',
            },
          },
        },
      },
      {
        name: 'get_latest_event',
        description: 'Get the most recent webhook event',
        inputSchema: {
          type: 'object',
          properties: {},
        },
      },
      {
        name: 'get_event_count',
        description: 'Get the total number of events received',
        inputSchema: {
          type: 'object',
          properties: {},
        },
      },
      {
        name: 'clear_events',
        description: 'Clear all stored webhook events',
        inputSchema: {
          type: 'object',
          properties: {},
        },
      },
    ],
  };
});

// Handle tool calls
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    switch (name) {
      case 'start_webhook_server': {
        const port = (args as any).port || 3000;
        const url = await startWebhookServer(port);
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({
                success: true,
                url,
                port,
                message: 'Webhook server started. In E2B sandbox, this will be exposed as a public HTTPS URL.',
              }),
            },
          ],
        };
      }

      case 'get_webhook_url': {
        if (!webhookServer) {
          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify({
                  success: false,
                  error: 'Webhook server not started. Call start_webhook_server first.',
                }),
              },
            ],
          };
        }

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({
                success: true,
                url: webhookUrl,
                port: webhookPort,
              }),
            },
          ],
        };
      }

      case 'get_events': {
        const limit = (args as any).limit;
        const events = limit ? webhookEvents.slice(-limit) : webhookEvents;

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({
                success: true,
                count: events.length,
                events,
              }),
            },
          ],
        };
      }

      case 'get_latest_event': {
        const latestEvent = webhookEvents[webhookEvents.length - 1];

        if (!latestEvent) {
          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify({
                  success: false,
                  message: 'No events received yet',
                }),
              },
            ],
          };
        }

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({
                success: true,
                event: latestEvent,
              }),
            },
          ],
        };
      }

      case 'get_event_count': {
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({
                success: true,
                count: webhookEvents.length,
              }),
            },
          ],
        };
      }

      case 'clear_events': {
        const count = webhookEvents.length;
        webhookEvents.length = 0;

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({
                success: true,
                message: `Cleared ${count} events`,
              }),
            },
          ],
        };
      }

      default:
        throw new Error(`Unknown tool: ${name}`);
    }
  } catch (error) {
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify({
            success: false,
            error: error instanceof Error ? error.message : String(error),
          }),
        },
      ],
      isError: true,
    };
  }
});

/**
 * Start MCP server
 */
async function main() {
  console.log('🚀 Starting Webhook Receiver MCP Server...');

  const transport = new StdioServerTransport();
  await server.connect(transport);

  console.log('✓ MCP Server ready');
  console.log('💡 Waiting for tool calls...');
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
