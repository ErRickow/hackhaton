# OpenAI SDK Tool Calling Guide - APILab

Panduan lengkap penggunaan OpenAI SDK (via Vercel AI SDK) untuk tool calling dalam APILab.

## 📚 Table of Contents

1. [Konsep Dasar](#konsep-dasar)
2. [Setup & Dependencies](#setup--dependencies)
3. [Implementasi Tool Calling](#implementasi-tool-calling)
4. [Pattern yang Digunakan](#pattern-yang-digunakan)
5. [Error Handling](#error-handling)
6. [Best Practices](#best-practices)

---

## Konsep Dasar

### Apa itu Tool Calling?

Tool calling adalah kemampuan LLM untuk memanggil fungsi/tools eksternal berdasarkan user request. Flow-nya:

```
User → LLM → Tool Decision → Tool Execution → LLM → Response
```

### Architecture APILab

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
┌──────────────────┐
│   MCP Server     │  ← E2B Sandbox
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

## Resources

- **Vercel AI SDK Docs**: https://sdk.vercel.ai/docs
- **OpenAI Function Calling**: https://platform.openai.com/docs/guides/function-calling
- **Zod Documentation**: https://zod.dev
- **MCP Protocol**: https://modelcontextprotocol.io

---

## Summary

**Key Takeaways:**

1. Use **Vercel AI SDK** dengan OpenAI-compatible providers
2. Define tools dengan **Zod schemas** + **type coercion**
3. Stream dengan `fullStream` dan handle all event types
4. Implement proper **error handling** dengan context untuk LLM
5. Allow **multi-step reasoning** dengan `maxSteps`
6. Track tool execution state untuk UI updates

**Next Steps:**

- Add more MCP tools (filesystem, database, etc.)
- Implement tool result caching
- Add streaming progress indicators
- Optimize for mobile responsiveness

---

Happy coding! 🚀
