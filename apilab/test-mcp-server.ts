/**
 * Test script for HTTP Client MCP Server
 * Tests the MCP server running in E2B sandbox
 */

import { startMcpSandbox } from '@netglade/mcp-sandbox';

async function testHttpClientMCP() {
  console.log('🧪 Testing HTTP Client MCP Server...\n');

  try {
    // Start the MCP server in E2B sandbox
    console.log('1. Starting MCP server in E2B sandbox...');

    const mcp = await startMcpSandbox({
      // Use npx to run our local MCP server
      // In E2B, we'll need to upload it or use npm package
      // For now, test with a simple command
      command: 'npx -y @modelcontextprotocol/server-filesystem /tmp',
      apiKey: process.env.VITE_E2B_API_KEY!,
    });

    console.log('✓ MCP server started successfully!');
    console.log('  URL:', mcp.getUrl());

    // Get available tools
    console.log('\n2. Getting available tools...');
    const tools = await mcp.getTools();
    console.log('✓ Tools available:', tools.length);
    tools.forEach((tool, i) => {
      console.log(`  ${i + 1}. ${tool.name}: ${tool.description}`);
    });

    // Test calling a tool
    console.log('\n3. Testing tool call...');
    const result = await mcp.callTool('list_directory', {
      path: '/tmp',
    });
    console.log('✓ Tool call successful!');
    console.log('  Result:', JSON.stringify(result, null, 2));

    console.log('\n✅ All tests passed!');
  } catch (error) {
    console.error('\n❌ Test failed:', error);
    throw error;
  }
}

// Run the test
testHttpClientMCP().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
