/**
 * useWebhooks Hook
 * Manages webhook receiver MCP server
 */

import { useState, useEffect, useCallback } from 'react';
import { startMcpSandbox } from '@netglade/mcp-sandbox';

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

export interface UseWebhooksReturn {
  webhookUrl: string | null;
  events: WebhookEvent[];
  isStarting: boolean;
  isReady: boolean;
  error: Error | null;
  startWebhookServer: () => Promise<void>;
  refreshEvents: () => Promise<void>;
  clearEvents: () => Promise<void>;
  getLatestEvent: () => Promise<WebhookEvent | null>;
}

export function useWebhooks(): UseWebhooksReturn {
  const [webhookServer, setWebhookServer] = useState<any>(null);
  const [webhookUrl, setWebhookUrl] = useState<string | null>(null);
  const [events, setEvents] = useState<WebhookEvent[]>([]);
  const [isStarting, setIsStarting] = useState(false);
  const [isReady, setIsReady] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const startWebhookServer = async () => {
    if (isStarting || isReady) return;

    setIsStarting(true);
    setError(null);

    try {
      console.log('🚀 Starting Webhook Receiver MCP server in E2B sandbox...');

      const apiKey = import.meta.env.VITE_E2B_API_KEY;
      if (!apiKey) {
        throw new Error('E2B API key not found. Please set VITE_E2B_API_KEY in .env file.');
      }

      // Start the webhook receiver MCP server in E2B sandbox
      const mcp = await startMcpSandbox({
        command: 'npx -y @apilab/webhook-receiver-mcp',
        apiKey,
      });

      console.log('✓ Webhook MCP server started');
      console.log('  URL:', mcp.getUrl());

      // Start the webhook server
      const startResult = await (mcp as any).callTool('start_webhook_server', {
        port: 3000,
      });

      const startData = JSON.parse(startResult.content[0].text);
      console.log('✓ Webhook server initialized:', startData);

      // Get the webhook URL (will be E2B's public URL)
      // In E2B, the URL will be the sandbox's public URL
      // We need to construct it from the MCP URL
      const mcpUrl = mcp.getUrl();
      const baseUrl = mcpUrl.replace('/sse', ''); // Remove /sse path
      const webhookPublicUrl = `${baseUrl}:3000/webhook`;

      console.log('✓ Webhook URL ready:', webhookPublicUrl);

      setWebhookServer(mcp);
      setWebhookUrl(webhookPublicUrl);
      setIsReady(true);
      setIsStarting(false);

      console.log('✅ Webhook receiver ready!');
      console.log('📍 Send webhooks to:', webhookPublicUrl);
    } catch (err) {
      console.error('❌ Failed to start webhook server:', err);
      setError(err instanceof Error ? err : new Error(String(err)));
      setIsStarting(false);
      setIsReady(false);
    }
  };

  const refreshEvents = useCallback(async () => {
    if (!webhookServer) return;

    try {
      const result = await (webhookServer as any).callTool('get_events', {});
      const data = JSON.parse(result.content[0].text);

      if (data.success) {
        setEvents(data.events || []);
      }
    } catch (err) {
      console.error('❌ Failed to refresh events:', err);
    }
  }, [webhookServer]);

  const clearEvents = useCallback(async () => {
    if (!webhookServer) return;

    try {
      await (webhookServer as any).callTool('clear_events', {});
      setEvents([]);
    } catch (err) {
      console.error('❌ Failed to clear events:', err);
    }
  }, [webhookServer]);

  const getLatestEvent = useCallback(async () => {
    if (!webhookServer) return null;

    try {
      const result = await (webhookServer as any).callTool('get_latest_event', {});
      const data = JSON.parse(result.content[0].text);

      if (data.success) {
        return data.event;
      }
      return null;
    } catch (err) {
      console.error('❌ Failed to get latest event:', err);
      return null;
    }
  }, [webhookServer]);

  // Auto-start on mount
  useEffect(() => {
    startWebhookServer();
  }, []);

  // Auto-refresh events every 3 seconds when ready
  useEffect(() => {
    if (!isReady) return;

    const interval = setInterval(() => {
      refreshEvents();
    }, 3000);

    return () => clearInterval(interval);
  }, [isReady, refreshEvents]);

  return {
    webhookUrl,
    events,
    isStarting,
    isReady,
    error,
    startWebhookServer,
    refreshEvents,
    clearEvents,
    getLatestEvent,
  };
}
