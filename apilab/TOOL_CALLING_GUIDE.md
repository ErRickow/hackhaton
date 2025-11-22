# OpenAI SDK Tool Calling Guide - APILab

Complete guide for using OpenAI SDK (via Vercel AI SDK) for tool calling in APILab.

## 📚 Table of Contents

1. [Basic Concepts](#basic-concepts)
2. [Setup & Dependencies](#setup--dependencies)
3. [Tool Calling Implementation](#tool-calling-implementation)
4. [Common Patterns](#common-patterns)
5. [Error Handling](#error-handling)
6. [Best Practices](#best-practices)
7. [Live Demo](#live-demo)

---

## Basic Concepts

### What is Tool Calling?

Tool calling enables LLMs to invoke external functions/tools based on user requests. The flow:

```
User → LLM → Tool Decision → Tool Execution → LLM → Response
```

### APILab Architecture

```
┌─────────────┐
│   User UI   │
└──────┬──────┘
       │
       v
┌─────────────────┐
│  useApiChat.ts  │  ← State management
└──────┬──────────┘
       │
       v
┌──────────────────┐
│ groq-client.ts   │  ← LLM streaming
└──────┬───────────┘
       │
       v
┌──────────────────┐
│  useMcpTools.ts  │  ← Tool definitions
└──────┬───────────┘
       │
       v
┌──────────────────────┐
│ e2b-mcp-api Worker  │  ← Cloudflare Worker (MCP Gateway)
└──────┬───────────────┘
       │
       v
┌──────────────────┐
│   E2B Sandbox    │  ← MCP Server Runtime
└──────────────────┘
```

---

## Setup & Dependencies

### 1. Install Dependencies

```bash
npm install ai @ai-sdk/openai zod
```

### 2. Required Packages

```typescript
import { createOpenAI } from '@ai-sdk/openai';
import { streamText, type ToolSet } from 'ai';
import { z } from 'zod';
```

---

## Implementasi Tool Calling

### 1. Create LLM Provider

**File: `/src/lib/groq-client.ts`**

```typescript
import { createOpenAI } from '@ai-sdk/openai';

export function createLLMProvider(provider: 'neosantara' | 'groq') {
  const apiKeys = getApiKeys();

  if (provider === 'neosantara') {
    return createOpenAI({
      apiKey: apiKeys.neosantara,
      baseURL: 'https://api.neosantara.xyz/v1',
    });
  }

  // Groq
  return createOpenAI({
    apiKey: apiKeys.groq,
    baseURL: 'https://api.groq.com/openai/v1',
  });
}
```

**Key Points:**
- `createOpenAI()` works with OpenAI-compatible APIs
- Neosantara dan Groq menggunakan OpenAI-compatible format
- `baseURL` override untuk custom endpoints

### 2. Define Tools dengan Zod Schema

**File: `/src/hooks/useMcpTools.ts`**

```typescript
import { z } from 'zod';

// Convert MCP JSON Schema to Zod Schema
function convertJsonSchemaToZod(schema: any) {
  const zodSchema: Record<string, any> = {};

  for (const [key, value] of Object.entries(schema.properties || {})) {
    let zodType: any;

    switch (value.type) {
      case 'string':
        zodType = z.string();
        break;

      case 'number':
      case 'integer':
        // IMPORTANT: Coerce untuk handle LLM yang kirim string
        zodType = z.coerce.number();
        break;

      case 'boolean':
        zodType = z.coerce.boolean();
        break;

      case 'array':
        zodType = z.array(z.any());
        break;

      case 'object':
        zodType = value.properties
          ? convertJsonSchemaToZod(value)
          : z.object({});
        break;

      default:
        zodType = z.any();
    }

    // Add description untuk LLM context
    if (value.description) {
      zodType = zodType.describe(value.description);
    }

    // Handle required fields
    if (!schema.required?.includes(key)) {
      zodType = zodType.optional();
    }

    zodSchema[key] = zodType;
  }

  return z.object(zodSchema);
}

// Create tools object untuk AI SDK
export function tools() {
  const toolsObject: Record<string, any> = {};

  for (const tool of mcpTools) {
    toolsObject[tool.name] = {
      description: tool.description,
      parameters: convertJsonSchemaToZod(tool.inputSchema),
      execute: async (args: Record<string, any>) => {
        // Call MCP server
        const result = await callMcpTool(tool.name, args);
        return result;
      },
    };
  }

  return toolsObject;
}
```

**Key Points:**
- **Zod Schema**: AI SDK requires Zod, not JSON Schema
- **Type Coercion**: Use `z.coerce.number()` untuk handle LLM type errors
- **Description**: Help LLM understand tool purpose
- **Execute Function**: Actual tool implementation

### 3. Stream Chat dengan Tool Calling

**File: `/src/lib/groq-client.ts`**

```typescript
export async function streamChatCompletion(
  messages: ChatMessage[],
  tools: any,
  onChunk: (text: string) => void,
  onComplete: () => void,
  onError: (error: Error) => void,
  onToolCallStart?: (id: string, name: string, args: any) => void,
  _onToolCallComplete?: (id: string, name: string, result: any) => void,
  provider: 'neosantara' | 'groq' = 'neosantara'
) {
  const llmProvider = createLLMProvider(provider);
  const modelName = getModelName(provider);

  // System prompt
  const systemMessage = messages.find(m => m.role === 'system');
  const systemPrompt = systemMessage?.content || '';

  // Format messages (exclude system)
  const formattedMessages = messages
    .filter(m => m.role !== 'system' && m.role !== 'tool')
    .map(m => ({
      role: m.role as 'user' | 'assistant',
      content: m.content,
    }));

  // Track tool calls
  const toolCallsMap = new Map<string, { name: string; args: any }>();

  // Start streaming
  const result = streamText({
    model: llmProvider(modelName),
    system: systemPrompt,
    messages: formattedMessages,
    tools: tools as ToolSet,
    maxSteps: 10, // Allow multi-step reasoning
  });

  // IMPORTANT: Iterate fullStream to consume chunks
  for await (const chunk of result.fullStream) {
    switch (chunk.type) {
      case 'text-delta':
        // Text streaming
        onChunk(chunk.textDelta);
        break;

      case 'tool-call-streaming-start':
        // Tool call started (args being generated)
        console.log(`🔧 Tool: ${chunk.toolName}`);
        toolCallsMap.set(chunk.toolCallId, {
          name: chunk.toolName,
          args: {},
        });
        onToolCallStart?.(chunk.toolCallId, chunk.toolName, {});
        break;

      case 'tool-call-delta':
        // Tool args streaming
        console.log(`📝 Args delta: ${chunk.argsTextDelta}`);
        break;

      case 'tool-call':
        // Tool call ready with full args
        toolCallsMap.set(chunk.toolCallId, {
          name: chunk.toolName,
          args: chunk.args,
        });
        console.log(`✓ Tool ready: ${chunk.toolName}`, chunk.args);
        onToolCallStart?.(chunk.toolCallId, chunk.toolName, chunk.args);
        break;

      case 'step-finish':
        console.log(`📊 Step finished`);
        break;

      case 'finish':
        console.log('✓ Stream finished');
        onComplete();
        break;

      case 'error':
        console.error('❌ Error:', chunk.error);
        onError(new Error(chunk.error));
        break;
    }
  }
}
```

**Key Streaming Events:**

| Event | Description | Data |
|-------|-------------|------|
| `text-delta` | Text chunk from LLM | `textDelta: string` |
| `tool-call-streaming-start` | Tool call begins | `toolCallId, toolName` |
| `tool-call-delta` | Tool args streaming | `argsTextDelta` |
| `tool-call` | Tool ready with args | `toolCallId, toolName, args` |
| `step-finish` | Reasoning step done | - |
| `finish` | Stream complete | - |
| `error` | Error occurred | `error` |

### 4. State Management

**File: `/src/hooks/useApiChat.ts`**

```typescript
export function useApiChat() {
  const { tools } = useMcpTools();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [toolExecutions, setToolExecutions] = useState<ToolExecution[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (userMessage: string) => {
    setIsLoading(true);

    // Add user message
    const newMessages = [...messages, { role: 'user', content: userMessage }];
    setMessages(newMessages);

    // Add system prompt
    const messagesWithSystem = [
      {
        role: 'system',
        content: 'You are a helpful AI assistant with access to tools...',
      },
      ...newMessages,
    ];

    let assistantMessage = '';

    await streamChatCompletion(
      messagesWithSystem,
      tools, // Pass MCP tools

      // On text chunk
      (chunk) => {
        assistantMessage += chunk;
        setMessages([
          ...newMessages,
          { role: 'assistant', content: assistantMessage },
        ]);
      },

      // On complete
      () => {
        setIsLoading(false);
      },

      // On error
      (err) => {
        setError(err);
        setIsLoading(false);
      },

      // On tool call start
      (toolCallId, toolName, args) => {
        const newExecution: ToolExecution = {
          id: toolCallId,
          toolName,
          status: 'running',
          args,
          startTime: Date.now(),
        };
        setToolExecutions(prev => [...prev, newExecution]);
      },

      // On tool call complete
      (toolCallId, toolName, result) => {
        setToolExecutions(prev =>
          prev.map(exec =>
            exec.id === toolCallId
              ? {
                  ...exec,
                  status: 'complete',
                  result,
                  endTime: Date.now(),
                }
              : exec
          )
        );
      }
    );
  };

  return { messages, toolExecutions, isLoading, handleSubmit };
}
```

---

## Pattern yang Digunakan

### 1. Multi-Step Reasoning

```typescript
const result = streamText({
  model: llmProvider(modelName),
  system: systemPrompt,
  messages: formattedMessages,
  tools: tools,
  maxSteps: 10, // ← Allow LLM to use multiple tools
});
```

**Benefit:**
- LLM can chain multiple tool calls
- Example: Search → Read → Summarize
- More intelligent responses

### 2. Auto Tool Execution

```typescript
// Tools with execute function
{
  'tavily_search': {
    description: 'Search the web for information',
    parameters: z.object({
      query: z.string(),
      max_results: z.coerce.number().optional(),
    }),
    execute: async (args) => {
      // AI SDK automatically calls this
      const result = await callMcpTool('tavily_search', args);
      return result;
    },
  }
}
```

**Benefit:**
- No manual tool execution needed
- AI SDK handles the flow automatically
- Results auto-injected into context

### 3. Type Coercion for LLM Errors

```typescript
// Problem: LLM sends "10" (string) but schema expects 10 (number)
// Solution: Use z.coerce
z.object({
  max_results: z.coerce.number(), // ✅ Converts "10" → 10
  include_raw: z.coerce.boolean(), // ✅ Converts "true" → true
})
```

### 4. Streaming with Tool Visibility

```typescript
// Track tool calls in UI
for await (const chunk of result.fullStream) {
  switch (chunk.type) {
    case 'tool-call-streaming-start':
      // Show "Searching..." in UI
      onToolCallStart(chunk.toolCallId, chunk.toolName, {});
      break;

    case 'tool-call':
      // Show full args in UI
      onToolCallStart(chunk.toolCallId, chunk.toolName, chunk.args);
      break;
  }
}
```

---

## Error Handling

### 1. Tool Execution Errors

```typescript
execute: async (args) => {
  try {
    const result = await callMcpTool(toolName, args);

    if (result.isError) {
      // Throw error dengan context untuk LLM
      throw new Error(
        `Tool execution failed: ${result.error}\n\n` +
        `Please try with different parameters or inform the user.`
      );
    }

    return result;
  } catch (error) {
    // Enhanced error message untuk AI
    throw new Error(
      `System Error in ${toolName}: ${error.message}\n\n` +
      `Please inform the user and suggest alternatives.`
    );
  }
}
```

**Key Points:**
- Error message should guide LLM
- Provide actionable suggestions
- Don't just throw generic errors

### 2. Network Errors & Retry

```typescript
// Auto-retry for sandbox 404
if (response.status === 404 && errorData.error === 'Sandbox not found') {
  console.warn('⚠️ Sandbox restarted. Reinitializing...');

  // Clear state
  mcpServerRef.current = null;
  setIsReady(false);

  // Re-initialize
  await startHttpClient();

  // Retry tool call
  return await callMcpTool(toolName, args);
}
```

### 3. Type Validation Errors

```typescript
// Validate with Zod before sending to LLM
const toolSchema = tools[toolName].parameters;

try {
  const validatedArgs = toolSchema.parse(args);
  return await callMcpTool(toolName, validatedArgs);
} catch (error) {
  if (error instanceof z.ZodError) {
    throw new Error(
      `Invalid arguments for ${toolName}:\n` +
      error.errors.map(e => `- ${e.path.join('.')}: ${e.message}`).join('\n')
    );
  }
  throw error;
}
```

---

## Best Practices

### ✅ DO

1. **Use Type Coercion**
   ```typescript
   z.coerce.number() // Instead of z.number()
   ```

2. **Provide Clear Descriptions**
   ```typescript
   {
     description: 'Search for academic papers on arXiv',
     parameters: z.object({
       query: z.string().describe('Search query (e.g., "machine learning")'),
       max_results: z.coerce.number().optional().describe('Max results (1-10)'),
     })
   }
   ```

3. **Handle Async Properly**
   ```typescript
   for await (const chunk of result.fullStream) {
     // Process each chunk
   }
   ```

4. **Track Tool State**
   ```typescript
   const [toolExecutions, setToolExecutions] = useState<ToolExecution[]>([]);
   // Update UI based on tool status
   ```

5. **Use System Prompts**
   ```typescript
   {
     system: 'You are a helpful assistant with access to tools. ' +
             'Always use tools when appropriate. Explain your reasoning.',
   }
   ```

### ❌ DON'T

1. **Don't Skip fullStream Iteration**
   ```typescript
   // ❌ Wrong - won't receive chunks
   const result = streamText({ ... });
   onChunk(result.text); // This won't work!

   // ✅ Correct
   for await (const chunk of result.fullStream) {
     if (chunk.type === 'text-delta') onChunk(chunk.textDelta);
   }
   ```

2. **Don't Use Strict Types**
   ```typescript
   // ❌ Will fail when LLM sends "10" instead of 10
   z.number()

   // ✅ Auto-converts types
   z.coerce.number()
   ```

3. **Don't Ignore Errors**
   ```typescript
   // ❌ Silent failure
   execute: async (args) => {
     try {
       return await callTool(args);
     } catch (e) {
       return { error: 'failed' }; // LLM won't know why!
     }
   }

   // ✅ Throw with context
   execute: async (args) => {
     try {
       return await callTool(args);
     } catch (e) {
       throw new Error(`Tool failed: ${e.message}. Please try X or Y.`);
     }
   }
   ```

4. **Don't Use toolChoice 'required'**
   ```typescript
   // ❌ Forces tool use even when not needed
   streamText({
     tools,
     toolChoice: 'required', // Bad!
   })

   // ✅ Let LLM decide
   streamText({
     tools,
     // No toolChoice - model decides naturally
   })
   ```

5. **Don't Forget maxSteps**
   ```typescript
   // ❌ Only one tool call allowed
   streamText({ tools })

   // ✅ Allow multi-step reasoning
   streamText({ tools, maxSteps: 10 })
   ```

---

## Example: Complete Tool Definition

```typescript
// Complete example: Tavily Search tool
export const tavilySearchTool = {
  // Tool metadata
  name: 'tavily_search',
  description: 'Search the web for up-to-date information using Tavily API',

  // Zod schema with coercion
  parameters: z.object({
    query: z.string()
      .describe('Search query - be specific and clear'),
    max_results: z.coerce.number()
      .min(1)
      .max(10)
      .optional()
      .default(5)
      .describe('Number of results to return (1-10, default: 5)'),
    include_raw_content: z.coerce.boolean()
      .optional()
      .default(false)
      .describe('Include raw HTML content'),
    topic: z.enum(['general', 'news'])
      .optional()
      .default('general')
      .describe('Search topic: general or news'),
  }),

  // Execution with error handling
  execute: async (args: {
    query: string;
    max_results?: number;
    include_raw_content?: boolean;
    topic?: 'general' | 'news';
  }) => {
    try {
      console.log(`🔍 Searching: "${args.query}"`);

      // Call MCP server
      const response = await fetch(`${backendUrl}/api/mcp/call/${sandboxId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          toolName: 'tavily_search',
          args,
        }),
      });

      if (!response.ok) {
        // Handle 404 (sandbox restart)
        if (response.status === 404) {
          console.warn('⚠️ Sandbox restarted. Reinitializing...');
          await reinitializeSandbox();
          // Retry
          return await tavilySearchTool.execute(args);
        }

        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const result = await response.json();

      // Check for MCP errors
      if (result.isError) {
        throw new Error(
          `Search failed: ${result.error}\n\n` +
          `Suggestion: Try a different query or reduce max_results.`
        );
      }

      console.log(`✓ Found ${result.results?.length || 0} results`);
      return result;

    } catch (error) {
      // Enhanced error for LLM
      const errorMsg = error instanceof Error ? error.message : String(error);
      throw new Error(
        `Tavily Search Error: ${errorMsg}\n\n` +
        `Please inform the user that the search failed and suggest trying:\n` +
        `1. A different search query\n` +
        `2. Reducing the number of results\n` +
        `3. Searching for more general terms`
      );
    }
  },
};
```

---

## Debugging Tips

### 1. Enable Verbose Logging

```typescript
console.log('🤖 LLM Provider:', provider);
console.log('📝 Model:', modelName);
console.log('🔧 Tools:', Object.keys(tools));
console.log('📋 System:', systemPrompt);
console.log('📨 Messages:', formattedMessages);
```

### 2. Track Tool Calls

```typescript
const toolCallsMap = new Map<string, { name: string; args: any }>();

// Log each tool call
case 'tool-call':
  console.log(`🔧 Tool: ${chunk.toolName}`);
  console.log(`📊 Args:`, chunk.args);
  toolCallsMap.set(chunk.toolCallId, { name: chunk.toolName, args: chunk.args });
  break;
```

### 3. Monitor Stream Events

```typescript
for await (const chunk of result.fullStream) {
  console.log(`[${chunk.type}]`, chunk);
}
```

---

## Common Issues & Solutions

### Issue 1: "Tool result not showing"

**Problem:** LLM calls tool but doesn't use result

**Solution:** Check `maxSteps`
```typescript
streamText({
  tools,
  maxSteps: 10, // ← Ensure this is set
})
```

### Issue 2: "Type validation errors"

**Problem:** LLM sends `"10"` but schema expects `10`

**Solution:** Use coercion
```typescript
// ❌ Before
z.object({ max_results: z.number() })

// ✅ After
z.object({ max_results: z.coerce.number() })
```

### Issue 3: "Stream doesn't emit chunks"

**Problem:** Not consuming `fullStream`

**Solution:** Iterate properly
```typescript
// ✅ Must use for await
for await (const chunk of result.fullStream) {
  if (chunk.type === 'text-delta') {
    onChunk(chunk.textDelta);
  }
}
```

### Issue 4: "Sandbox not found (404)"

**Problem:** Cloudflare Worker restart cleared cache

**Solution:** Implement auto-recovery
```typescript
if (response.status === 404) {
  await reinitializeSandbox();
  return await retryToolCall(toolName, args);
}
```

---

## Live Demo

### Complete Working Example with Cloudflare Worker

This demo shows how to use OpenAI SDK with tools deployed on Cloudflare Worker (e2b-mcp-api).

#### 1. Cloudflare Worker Setup (e2b-mcp-api)

**File: `worker.mjs`**

```javascript
// Cloudflare Worker - MCP Gateway API
export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    // CORS headers
    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    };

    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }

    // Initialize MCP session
    if (url.pathname === '/api/mcp/init') {
      const { E2B_API_KEY } = env;

      // Create E2B sandbox with MCP server
      const sandbox = await fetch('https://api.e2b.dev/sandboxes', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${E2B_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          template: 'mcp-server', // Custom template with MCP tools
        }),
      });

      const { sandboxId } = await sandbox.json();

      return Response.json(
        { sandboxId, session: `mcp-${Date.now()}` },
        { headers: corsHeaders }
      );
    }

    // List available tools
    if (url.pathname.startsWith('/api/mcp/tools/')) {
      const sandboxId = url.pathname.split('/')[4];

      // Call MCP server's tools/list
      const tools = await fetch(
        `https://api.e2b.dev/sandboxes/${sandboxId}/mcp/tools/list`,
        {
          headers: { 'Authorization': `Bearer ${env.E2B_API_KEY}` },
        }
      );

      return new Response(tools.body, { headers: corsHeaders });
    }

    // Call tool
    if (url.pathname.startsWith('/api/mcp/call/')) {
      const sandboxId = url.pathname.split('/')[4];
      const { toolName, args } = await request.json();

      // Execute tool via MCP server
      const result = await fetch(
        `https://api.e2b.dev/sandboxes/${sandboxId}/mcp/tools/call`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${env.E2B_API_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ name: toolName, arguments: args }),
        }
      );

      return new Response(result.body, { headers: corsHeaders });
    }

    return new Response('Not Found', { status: 404, headers: corsHeaders });
  },
};
```

**Deploy to Cloudflare:**

```bash
# Deploy worker
npx wrangler deploy worker.mjs

# Add secrets
npx wrangler secret put E2B_API_KEY
```

#### 2. Frontend Integration with OpenAI SDK

**File: `src/hooks/useMcpTools.ts`**

```typescript
import { useState, useEffect, useRef } from 'react';
import { z } from 'zod';

export function useMcpTools() {
  const [isReady, setIsReady] = useState(false);
  const [tools, setTools] = useState<Record<string, any>>({});
  const [error, setError] = useState<Error | null>(null);

  const backendUrl = 'https://your-worker.workers.dev'; // Your Cloudflare Worker
  const sandboxIdRef = useRef<string | null>(null);

  // Initialize MCP session
  useEffect(() => {
    async function init() {
      try {
        // 1. Initialize MCP session
        const initRes = await fetch(`${backendUrl}/api/mcp/init`, {
          method: 'POST',
        });
        const { sandboxId } = await initRes.json();
        sandboxIdRef.current = sandboxId;

        // 2. Fetch available tools
        const toolsRes = await fetch(`${backendUrl}/api/mcp/tools/${sandboxId}`);
        const { tools: mcpTools } = await toolsRes.json();

        // 3. Convert to AI SDK format
        const aiSdkTools: Record<string, any> = {};

        for (const tool of mcpTools) {
          aiSdkTools[tool.name] = {
            description: tool.description,
            parameters: convertJsonSchemaToZod(tool.inputSchema),
            execute: async (args: Record<string, any>) => {
              // Call tool via worker
              const res = await fetch(`${backendUrl}/api/mcp/call/${sandboxId}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ toolName: tool.name, args }),
              });

              return await res.json();
            },
          };
        }

        setTools(aiSdkTools);
        setIsReady(true);
        console.log('✓ MCP Tools Ready:', Object.keys(aiSdkTools));
      } catch (err) {
        setError(err instanceof Error ? err : new Error(String(err)));
      }
    }

    init();
  }, []);

  return { isReady, tools, error };
}

function convertJsonSchemaToZod(schema: any) {
  const zodSchema: Record<string, any> = {};

  for (const [key, value] of Object.entries(schema.properties || {})) {
    let zodType: any;

    switch (value.type) {
      case 'string':
        zodType = z.string();
        break;
      case 'number':
      case 'integer':
        zodType = z.coerce.number(); // Auto-convert "10" → 10
        break;
      case 'boolean':
        zodType = z.coerce.boolean();
        break;
      case 'array':
        zodType = z.array(z.any());
        break;
      default:
        zodType = z.any();
    }

    if (value.description) {
      zodType = zodType.describe(value.description);
    }

    if (!schema.required?.includes(key)) {
      zodType = zodType.optional();
    }

    zodSchema[key] = zodType;
  }

  return z.object(zodSchema);
}
```

**File: `src/lib/groq-client.ts`**

```typescript
import { createOpenAI } from '@ai-sdk/openai';
import { streamText } from 'ai';

export async function streamChatCompletion(
  messages: Array<{ role: string; content: string }>,
  tools: any,
  onChunk: (text: string) => void,
  onComplete: () => void,
  onError: (error: Error) => void,
  onToolCall?: (id: string, name: string, args: any) => void
) {
  // Create Neosantara AI client
  const neosantara = createOpenAI({
    apiKey: 'nsk_your_key_here',
    baseURL: 'https://api.neosantara.xyz/v1',
  });

  const result = streamText({
    model: neosantara('neosantara/Meta-Llama-3.1-70B-Instruct-Turbo'),
    system: 'You are a helpful AI assistant with access to real-time tools.',
    messages: messages.map(m => ({
      role: m.role as 'user' | 'assistant',
      content: m.content,
    })),
    tools, // MCP tools from worker
    maxSteps: 10, // Allow multi-step tool use
  });

  try {
    for await (const chunk of result.fullStream) {
      switch (chunk.type) {
        case 'text-delta':
          onChunk(chunk.textDelta);
          break;

        case 'tool-call':
          console.log(`🔧 Tool: ${chunk.toolName}`, chunk.args);
          onToolCall?.(chunk.toolCallId, chunk.toolName, chunk.args);
          break;

        case 'finish':
          onComplete();
          break;

        case 'error':
          onError(new Error(chunk.error));
          break;
      }
    }
  } catch (error) {
    onError(error instanceof Error ? error : new Error(String(error)));
  }
}
```

#### 3. React Component Usage

**File: `src/App.tsx`**

```typescript
import { useState } from 'react';
import { useMcpTools } from './hooks/useMcpTools';
import { streamChatCompletion } from './lib/groq-client';

export function App() {
  const { isReady, tools } = useMcpTools();
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!input.trim() || !isReady) return;

    const userMessage = { role: 'user', content: input };
    const newMessages = [...messages, userMessage];
    setMessages(newMessages);
    setInput('');
    setIsLoading(true);

    let assistantMessage = '';

    await streamChatCompletion(
      newMessages,
      tools,

      // On text chunk
      (chunk) => {
        assistantMessage += chunk;
        setMessages([...newMessages, { role: 'assistant', content: assistantMessage }]);
      },

      // On complete
      () => setIsLoading(false),

      // On error
      (error) => {
        console.error(error);
        setIsLoading(false);
      },

      // On tool call
      (id, name, args) => {
        console.log(`Tool called: ${name}`, args);
      }
    );
  };

  return (
    <div>
      <h1>APILab - AI with MCP Tools</h1>

      <div>
        {messages.map((msg, i) => (
          <div key={i} className={msg.role}>
            {msg.content}
          </div>
        ))}
      </div>

      <form onSubmit={handleSubmit}>
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={isReady ? "Ask anything..." : "Loading tools..."}
          disabled={isLoading || !isReady}
        />
        <button type="submit" disabled={isLoading || !isReady}>
          Send
        </button>
      </form>
    </div>
  );
}
```

#### 4. Example: Using Tavily Search Tool

**User Input:**
```
"Search for the latest AI research papers"
```

**LLM Decision:**
```json
{
  "tool": "tavily_search",
  "arguments": {
    "query": "latest AI research papers 2024",
    "max_results": 5
  }
}
```

**Tool Execution (via Worker):**
```javascript
// Worker calls E2B sandbox
POST https://api.e2b.dev/sandboxes/{sandboxId}/mcp/tools/call
{
  "name": "tavily_search",
  "arguments": {
    "query": "latest AI research papers 2024",
    "max_results": 5
  }
}
```

**Tool Response:**
```json
{
  "results": [
    {
      "title": "GPT-5: Next Generation Language Models",
      "url": "https://arxiv.org/...",
      "snippet": "..."
    },
    // ... more results
  ]
}
```

**LLM Final Response:**
```
Based on my search, here are the latest AI research papers from 2024:

1. **GPT-5: Next Generation Language Models**
   - Link: https://arxiv.org/...
   - This paper explores...

2. ...
```

#### 5. Testing the Integration

```bash
# 1. Deploy Cloudflare Worker
cd worker
npx wrangler deploy

# 2. Update frontend config
# Set backendUrl in useMcpTools.ts to your worker URL

# 3. Run frontend
cd ../apilab
npm run dev

# 4. Test in browser
# Open http://localhost:5173
# Try: "Search for machine learning papers"
```

#### 6. Monitoring Tool Calls

**Browser Console Output:**
```
🤖 LLM Provider: neosantara
📝 Model: Meta-Llama-3.1-70B-Instruct-Turbo
🔧 Tools: tavily_search, arxiv_search, weather
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🔧 Tool: tavily_search
📊 Args: { query: "machine learning papers", max_results: 5 }
✓ MCP tool result: { results: [...] }
✓ Stream finished
```

---

## Resources

- **Vercel AI SDK Docs**: https://sdk.vercel.ai/docs
- **OpenAI Function Calling**: https://platform.openai.com/docs/guides/function-calling
- **Zod Documentation**: https://zod.dev
- **MCP Protocol**: https://modelcontextprotocol.io
- **Cloudflare Workers**: https://developers.cloudflare.com/workers
- **E2B Sandboxes**: https://e2b.dev/docs

---

## Summary

**Key Takeaways:**

1. Use **Vercel AI SDK** with OpenAI-compatible providers
2. Define tools with **Zod schemas** + **type coercion**
3. Stream with `fullStream` and handle all event types
4. Implement proper **error handling** with context for LLM
5. Allow **multi-step reasoning** with `maxSteps`
6. Track tool execution state for UI updates
7. Deploy tools on **Cloudflare Worker** for production use

**Architecture Benefits:**

- **Serverless**: No server management, auto-scaling
- **Fast**: Edge computing with global CDN
- **Secure**: Secrets stored in Cloudflare
- **Cost-effective**: Pay only for requests
- **MCP Standard**: Compatible with any MCP server

**Next Steps:**

- Add more MCP tools (filesystem, database, code execution)
- Implement tool result caching for performance
- Add streaming progress indicators in UI
- Optimize for mobile responsiveness
- Set up monitoring and analytics

---

Happy coding! 🚀
