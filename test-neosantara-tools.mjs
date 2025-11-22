#!/usr/bin/env node

/**
 * Test Script: Neosantara API + MCP Worker Tool Calling
 *
 * This script tests if Neosantara API can properly call tools
 * using the same configuration as our app.
 */

import { createOpenAI } from '@ai-sdk/openai';
import { streamText, tool } from 'ai';
import { z } from 'zod';

// Configuration - UPDATE THESE WITH YOUR ACTUAL VALUES
const NEOSANTARA_API_KEY = process.env.NEOSANTARA_API_KEY || 'YOUR_KEY_HERE';
const BACKEND_URL = process.env.BACKEND_URL || 'https://apilab-mcp-api.apinya.workers.dev';
const E2B_API_KEY = process.env.E2B_API_KEY || 'YOUR_E2B_KEY_HERE';

console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('🧪 Neosantara + MCP Worker Tool Calling Test');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

// Test 1: Simple hardcoded tool (like test_tool)
console.log('📝 Test 1: Hardcoded Tool (Baseline Test)');
console.log('─────────────────────────────────────────────────\n');

const simpleTestTool = tool({
  description: 'Get the current time. Use this when user asks for time.',
  parameters: z.object({
    timezone: z.string().describe('Timezone name (e.g., "Asia/Jakarta")').optional(),
  }),
  execute: async ({ timezone }) => {
    console.log('✅ TOOL WAS CALLED! Timezone:', timezone || 'UTC');
    return {
      time: new Date().toISOString(),
      timezone: timezone || 'UTC',
      message: 'Tool calling works!'
    };
  },
});

// Test 2: MCP Worker tool
console.log('📝 Test 2: MCP Worker Tool (Real Backend Integration)');
console.log('─────────────────────────────────────────────────\n');

let sandboxId = null;

const mcpSearchTool = tool({
  description: 'Search the web using DuckDuckGo. Use this when user wants to search for information.',
  parameters: z.object({
    query: z.string().describe('The search query'),
  }),
  execute: async ({ query }) => {
    console.log('🔧 Calling MCP backend for search:', query);

    try {
      // Call worker backend
      const response = await fetch(`${BACKEND_URL}/api/mcp/call/${sandboxId}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          toolName: 'duckduckgo_search',
          args: { query }
        })
      });

      if (!response.ok) {
        throw new Error(`Backend error: ${response.status} ${response.statusText}`);
      }

      const result = await response.json();
      console.log('✅ MCP tool executed successfully');

      // Unwrap result if needed
      if (result && typeof result === 'object' && 'result' in result) {
        return result.result;
      }

      return result;
    } catch (error) {
      console.error('❌ MCP tool call failed:', error.message);
      throw error;
    }
  },
});

// Initialize MCP backend first
async function initMcpBackend() {
  console.log('🚀 Initializing MCP Backend...');

  try {
    const response = await fetch(`${BACKEND_URL}/api/mcp/init`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        apiKey: E2B_API_KEY,
        mcpServers: {
          duckduckgo: {},
          arxiv: { storagePath: '/' },
        }
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Backend init failed: ${response.status} ${errorText}`);
    }

    const data = await response.json();
    sandboxId = data.sandboxId;

    console.log(`✅ MCP Backend initialized! Sandbox ID: ${sandboxId}\n`);
    return true;
  } catch (error) {
    console.error('❌ Failed to initialize MCP backend:', error.message);
    return false;
  }
}

// Run test with Neosantara
async function testWithNeosantara(testName, tools, userMessage) {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`🧪 ${testName}`);
  console.log(`${'='.repeat(60)}\n`);
  console.log(`User: "${userMessage}"\n`);

  const provider = createOpenAI({
    apiKey: NEOSANTARA_API_KEY,
    baseURL: 'https://api.neosantara.xyz/v1',
  });

  let fullResponse = '';
  let toolsCalled = [];

  try {
    const result = streamText({
      model: provider('nusantara-base'),
      system: 'You are a helpful assistant.',
      messages: [
        { role: 'user', content: userMessage }
      ],
      tools: tools,
      maxSteps: 10,
    });

    // Process stream
    for await (const chunk of result.fullStream) {
      switch (chunk.type) {
        case 'text-delta':
          fullResponse += chunk.textDelta;
          process.stdout.write(chunk.textDelta);
          break;

        case 'tool-call':
          console.log(`\n🔧 Tool called: ${chunk.toolName}`);
          console.log(`   Args:`, JSON.stringify(chunk.args, null, 2));
          toolsCalled.push(chunk.toolName);
          break;

        case 'tool-result':
          console.log(`✅ Tool result received`);
          console.log(`   Result:`, JSON.stringify(chunk.result, null, 2));
          break;

        case 'finish':
          console.log(`\n\n✓ Stream finished (${chunk.finishReason})`);
          break;

        case 'error':
          console.error('\n❌ Stream error:', chunk.error);
          throw chunk.error;
      }
    }

    console.log('\n');
    console.log('━'.repeat(60));
    console.log(`📊 Test Results:`);
    console.log(`   Tools called: ${toolsCalled.length > 0 ? toolsCalled.join(', ') : 'NONE ❌'}`);
    console.log(`   Response length: ${fullResponse.length} chars`);
    console.log('━'.repeat(60));

    return toolsCalled.length > 0;

  } catch (error) {
    console.error('\n❌ Test failed:', error.message);
    console.error('   Full error:', error);
    return false;
  }
}

// Main test runner
async function runTests() {
  console.log('Starting tests...\n');

  // Test 1: Simple tool
  const test1Result = await testWithNeosantara(
    'Test 1: Simple Hardcoded Tool',
    { getCurrentTime: simpleTestTool },
    'What time is it now?'
  );

  // Test 2: MCP backend (if backend is available)
  let test2Result = false;
  if (E2B_API_KEY !== 'YOUR_E2B_KEY_HERE') {
    const mcpReady = await initMcpBackend();
    if (mcpReady) {
      test2Result = await testWithNeosantara(
        'Test 2: MCP Worker Backend Tool',
        { searchWeb: mcpSearchTool },
        'Search for latest AI news'
      );
    }
  } else {
    console.log('\n⚠️  Skipping Test 2 (E2B_API_KEY not configured)');
  }

  // Summary
  console.log('\n\n');
  console.log('━'.repeat(60));
  console.log('📋 TEST SUMMARY');
  console.log('━'.repeat(60));
  console.log(`Test 1 (Hardcoded Tool): ${test1Result ? '✅ PASS' : '❌ FAIL'}`);
  console.log(`Test 2 (MCP Backend):     ${E2B_API_KEY !== 'YOUR_E2B_KEY_HERE' ? (test2Result ? '✅ PASS' : '❌ FAIL') : '⊘ SKIPPED'}`);
  console.log('━'.repeat(60));

  if (!test1Result) {
    console.log('\n❌ CRITICAL: Simple tool calling failed!');
    console.log('   This means Neosantara API is not calling tools at all.');
    console.log('   Possible issues:');
    console.log('   - Model "nusantara-base" may not support function calling');
    console.log('   - API key may not have function calling access');
    console.log('   - Tool format may be incompatible');
  } else if (!test2Result && E2B_API_KEY !== 'YOUR_E2B_KEY_HERE') {
    console.log('\n⚠️  Simple tool works, but MCP backend tool failed');
    console.log('   This means tool calling works, but there\'s an issue with:');
    console.log('   - MCP backend integration');
    console.log('   - Tool schema conversion');
    console.log('   - Backend API communication');
  } else if (test1Result) {
    console.log('\n✅ SUCCESS: Tool calling is working!');
    console.log('   Neosantara API can successfully call tools.');
    if (test2Result) {
      console.log('   MCP backend integration is also working.');
    }
  }

  console.log('\n');
}

// Run all tests
runTests().catch(error => {
  console.error('\n💥 Fatal error:', error);
  process.exit(1);
});
