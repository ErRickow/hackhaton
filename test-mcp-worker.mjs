#!/usr/bin/env node

/**
 * Test Script: MCP Worker API Endpoints
 *
 * This script tests the worker backend endpoints independently
 * to verify they work correctly.
 */

// Configuration
const BACKEND_URL = process.env.BACKEND_URL || 'https://apilab-mcp-api.apinya.workers.dev';
const E2B_API_KEY = process.env.E2B_API_KEY || 'YOUR_E2B_KEY_HERE';

console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('🧪 MCP Worker API Test');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
console.log(`Backend URL: ${BACKEND_URL}`);
console.log(`E2B API Key: ${E2B_API_KEY.substring(0, 10)}...${E2B_API_KEY.substring(E2B_API_KEY.length - 4)}\n`);

let sandboxId = null;

// Test 1: Initialize MCP backend
async function testInit() {
  console.log('📝 Test 1: POST /api/mcp/init');
  console.log('─────────────────────────────────────────────────\n');

  try {
    console.log('Sending request...');
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

    console.log(`Status: ${response.status} ${response.statusText}`);

    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ Error response:', errorText);
      return false;
    }

    const data = await response.json();
    sandboxId = data.sandboxId;

    console.log('✅ Success!');
    console.log('Response:', JSON.stringify(data, null, 2));
    console.log(`\nSandbox ID: ${sandboxId}\n`);

    return true;
  } catch (error) {
    console.error('❌ Request failed:', error.message);
    return false;
  }
}

// Test 2: Get tools list
async function testGetTools() {
  if (!sandboxId) {
    console.log('⊘ Skipping (no sandbox ID)\n');
    return false;
  }

  console.log('📝 Test 2: GET /api/mcp/tools/:sandboxId');
  console.log('─────────────────────────────────────────────────\n');

  try {
    console.log(`Sending request to /api/mcp/tools/${sandboxId}...`);
    const response = await fetch(`${BACKEND_URL}/api/mcp/tools/${sandboxId}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      }
    });

    console.log(`Status: ${response.status} ${response.statusText}`);

    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ Error response:', errorText);
      return false;
    }

    const data = await response.json();

    console.log('✅ Success!');
    console.log(`Found ${data.tools?.length || 0} tools:`);

    if (data.tools && Array.isArray(data.tools)) {
      data.tools.forEach((tool, idx) => {
        console.log(`\n  ${idx + 1}. ${tool.name}`);
        console.log(`     Description: ${tool.description || 'N/A'}`);
        console.log(`     Parameters:`, JSON.stringify(tool.inputSchema?.properties || {}, null, 2).split('\n').map((line, i) => i === 0 ? line : '                 ' + line).join('\n'));
      });
    }

    console.log('\n');
    return true;
  } catch (error) {
    console.error('❌ Request failed:', error.message);
    return false;
  }
}

// Test 3: Call a tool
async function testCallTool() {
  if (!sandboxId) {
    console.log('⊘ Skipping (no sandbox ID)\n');
    return false;
  }

  console.log('📝 Test 3: POST /api/mcp/call/:sandboxId');
  console.log('─────────────────────────────────────────────────\n');

  try {
    console.log('Calling duckduckgo_search with query "AI news"...');
    const response = await fetch(`${BACKEND_URL}/api/mcp/call/${sandboxId}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        toolName: 'duckduckgo_search',
        args: {
          query: 'AI news',
        }
      })
    });

    console.log(`Status: ${response.status} ${response.statusText}`);

    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ Error response:', errorText);
      return false;
    }

    const data = await response.json();

    console.log('✅ Success!');
    console.log('Response structure:', {
      hasResult: 'result' in data,
      hasIsError: 'isError' in data,
      isError: data.isError,
      resultType: typeof data.result,
    });

    // Show result preview
    if (data.result) {
      const resultStr = JSON.stringify(data.result, null, 2);
      const preview = resultStr.length > 500 ? resultStr.substring(0, 500) + '\n  ... (truncated)' : resultStr;
      console.log('\nResult preview:');
      console.log(preview);
    }

    console.log('\n');
    return true;
  } catch (error) {
    console.error('❌ Request failed:', error.message);
    return false;
  }
}

// Run all tests
async function runTests() {
  const results = {
    init: false,
    getTools: false,
    callTool: false,
  };

  results.init = await testInit();

  if (results.init) {
    results.getTools = await testGetTools();
    results.callTool = await testCallTool();
  }

  // Summary
  console.log('━'.repeat(60));
  console.log('📋 TEST SUMMARY');
  console.log('━'.repeat(60));
  console.log(`1. Initialize MCP:  ${results.init ? '✅ PASS' : '❌ FAIL'}`);
  console.log(`2. Get Tools:       ${results.init ? (results.getTools ? '✅ PASS' : '❌ FAIL') : '⊘ SKIPPED'}`);
  console.log(`3. Call Tool:       ${results.init ? (results.callTool ? '✅ PASS' : '❌ FAIL') : '⊘ SKIPPED'}`);
  console.log('━'.repeat(60));

  if (results.init && results.getTools && results.callTool) {
    console.log('\n✅ All tests passed! Worker API is working correctly.\n');
  } else if (!results.init) {
    console.log('\n❌ Initialization failed. Check:');
    console.log('   - E2B API key is valid');
    console.log('   - Worker is deployed and accessible');
    console.log('   - Backend URL is correct\n');
  } else {
    console.log('\n⚠️  Some tests failed. Check worker logs for details.\n');
  }
}

// Check if API key is configured
if (E2B_API_KEY === 'YOUR_E2B_KEY_HERE') {
  console.log('❌ Error: E2B_API_KEY not configured!');
  console.log('\nUsage:');
  console.log('  E2B_API_KEY=your_key node test-mcp-worker.mjs');
  console.log('  or');
  console.log('  BACKEND_URL=https://your-worker.workers.dev E2B_API_KEY=your_key node test-mcp-worker.mjs\n');
  process.exit(1);
}

runTests().catch(error => {
  console.error('\n💥 Fatal error:', error);
  process.exit(1);
});
