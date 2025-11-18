/**
 * Manual Test Script for MCP Gateway
 *
 * Usage:
 *   node test-mcp-gateway.mjs
 *
 * Environment variables needed:
 *   E2B_API_KEY - Your E2B API key
 *   BACKEND_URL - Backend URL (default: http://localhost:3001)
 */

const E2B_API_KEY = process.env.E2B_API_KEY;
const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:3001';

if (!E2B_API_KEY) {
  console.error('❌ Error: E2B_API_KEY environment variable is required');
  console.error('Usage: E2B_API_KEY=your_key node test-mcp-gateway.mjs');
  process.exit(1);
}

console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('🧪 MCP Gateway Manual Test');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
console.log(`Backend URL: ${BACKEND_URL}`);
console.log(`E2B API Key: ${E2B_API_KEY.substring(0, 10)}...`);
console.log('');

async function testMcpGateway() {
  try {
    // Step 1: Create sandbox
    console.log('📦 Step 1: Creating E2B sandbox...');
    const initResponse = await fetch(`${BACKEND_URL}/api/mcp/init`, {
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

    if (!initResponse.ok) {
      const errorText = await initResponse.text();
      throw new Error(`Init failed (${initResponse.status}): ${errorText}`);
    }

    const { sandboxId, mcpUrl, mcpToken } = await initResponse.json();
    console.log('✅ Sandbox created!');
    console.log(`   Sandbox ID: ${sandboxId}`);
    console.log(`   MCP URL: ${mcpUrl}`);
    console.log(`   Token: ${mcpToken.substring(0, 20)}...\n`);

    // Step 2: List tools via backend proxy
    console.log('🔧 Step 2: Listing tools via backend proxy...');
    const toolsResponse = await fetch(`${BACKEND_URL}/api/mcp/tools/${sandboxId}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      }
    });

    if (!toolsResponse.ok) {
      const errorText = await toolsResponse.text();
      throw new Error(`List tools failed (${toolsResponse.status}): ${errorText}`);
    }

    const { tools } = await toolsResponse.json();
    console.log(`✅ Found ${tools.length} tools:`);
    tools.forEach((tool, i) => {
      console.log(`   ${i + 1}. ${tool.name}: ${tool.description || 'No description'}`);
    });
    console.log('');

    // Step 3: Direct test to MCP gateway (bypass backend)
    console.log('🎯 Step 3: Testing direct MCP gateway call...');
    console.log(`   URL: ${mcpUrl}`);

    const mcpResponse = await fetch(mcpUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${mcpToken}`,
        'Accept': 'application/json, text/event-stream',
      },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: Date.now(),
        method: 'tools/list',
        params: {}
      })
    });

    console.log(`   Response status: ${mcpResponse.status}`);
    console.log(`   Content-Type: ${mcpResponse.headers.get('content-type')}`);

    if (!mcpResponse.ok) {
      const errorText = await mcpResponse.text();
      console.log(`   ❌ Error response:\n${errorText}`);
      throw new Error(`MCP gateway failed (${mcpResponse.status}): ${errorText}`);
    }

    const contentType = mcpResponse.headers.get('content-type') || '';

    if (contentType.includes('text/event-stream')) {
      console.log('   📡 Response format: SSE (Server-Sent Events)');
      const text = await mcpResponse.text();
      console.log('   Raw SSE response (first 500 chars):');
      console.log('   ' + text.substring(0, 500).replace(/\n/g, '\n   '));

      // Try to parse SSE
      const dataMatch = text.match(/data: (.*)\n/);
      if (dataMatch) {
        const data = JSON.parse(dataMatch[1]);
        console.log(`\n   ✅ Parsed SSE successfully!`);
        console.log(`   Tools count: ${data.result?.tools?.length || 0}`);
      }
    } else if (contentType.includes('application/json')) {
      console.log('   📄 Response format: JSON');
      const data = await mcpResponse.json();
      console.log('   ✅ Parsed JSON successfully!');
      console.log(`   Tools count: ${data.result?.tools?.length || 0}`);
    } else {
      console.log(`   ⚠️ Unknown content type: ${contentType}`);
    }

    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('✅ All tests passed!');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  } catch (error) {
    console.error('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.error('❌ Test failed!');
    console.error('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.error('Error:', error.message);
    if (error.stack) {
      console.error('\nStack trace:');
      console.error(error.stack);
    }
    process.exit(1);
  }
}

// Run the test
testMcpGateway();
