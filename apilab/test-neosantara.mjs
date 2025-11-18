/**
 * Test Neosantara API with AI SDK
 *
 * Usage: node test-neosantara.mjs
 */

import { createOpenAI } from '@ai-sdk/openai';
import { streamText } from 'ai';

const NEOSANTARA_API_KEY = 'naipencak_silat-95dc74625206413b-2549';

console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('🧪 Testing Neosantara API with AI SDK');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

async function testNeosantara() {
  try {
    console.log('📝 Configuration:');
    console.log(`   API Key: ${NEOSANTARA_API_KEY.substring(0, 20)}...`);
    console.log(`   Base URL: https://api.neosantara.xyz/v1`);
    console.log(`   Model: nusantara-base\n`);

    // Create Neosantara provider
    console.log('🔧 Creating OpenAI-compatible client...');
    const neosantara = createOpenAI({
      apiKey: NEOSANTARA_API_KEY,
      baseURL: 'https://api.neosantara.xyz/v1',
    });
    console.log('✅ Client created\n');

    // Test 1: Simple text generation (no tools)
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('📊 Test 1: Simple text generation');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    let streamedText = '';
    let chunkCount = 0;

    console.log('🚀 Starting stream...\n');
    console.log('Response: ');

    const result = await streamText({
      model: neosantara('nusantara-base'),
      messages: [
        {
          role: 'user',
          content: 'Halo! Ceritakan tentang Indonesia dalam 2 kalimat.',
        },
      ],
      onChunk: ({ chunk }) => {
        chunkCount++;
        if (chunk.type === 'text-delta') {
          process.stdout.write(chunk.textDelta);
          streamedText += chunk.textDelta;
        }
      },
    });

    // Wait for completion
    const fullText = await result.text;

    console.log('\n\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('✅ Test 1 Results:');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`   Chunks received: ${chunkCount}`);
    console.log(`   Streamed text length: ${streamedText.length} chars`);
    console.log(`   Full text length: ${fullText.length} chars`);
    console.log(`   Match: ${streamedText === fullText ? '✅' : '❌'}\n`);

    // Test 2: With function calling
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('📊 Test 2: Function calling test');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    // Define a simple tool
    const tools = {
      get_weather: {
        description: 'Get weather information for a city',
        parameters: {
          type: 'object',
          properties: {
            city: {
              type: 'string',
              description: 'City name',
            },
          },
          required: ['city'],
        },
        execute: async ({ city }) => {
          console.log(`\n🔧 Tool called: get_weather(city="${city}")`);
          return {
            city,
            temperature: 28,
            condition: 'Sunny',
          };
        },
      },
    };

    let streamedText2 = '';
    let chunkCount2 = 0;
    let toolCallsDetected = 0;
    let toolResultsDetected = 0;

    console.log('🚀 Starting stream with tools...\n');
    console.log('Response: ');

    const result2 = await streamText({
      model: neosantara('nusantara-base'),
      messages: [
        {
          role: 'user',
          content: 'What is the weather in Jakarta?',
        },
      ],
      tools,
      maxSteps: 5,
      onChunk: ({ chunk }) => {
        chunkCount2++;

        if (chunk.type === 'text-delta') {
          process.stdout.write(chunk.textDelta);
          streamedText2 += chunk.textDelta;
        } else if (chunk.type === 'tool-call') {
          toolCallsDetected++;
          console.log(`\n\n🔧 Tool call detected: ${chunk.toolName}`);
          console.log(`   Args:`, chunk.args);
        } else if (chunk.type === 'tool-result') {
          toolResultsDetected++;
          console.log(`\n✅ Tool result received`);
          console.log(`   Result:`, chunk.result);
          console.log('\nContinuing response: ');
        }
      },
    });

    const fullText2 = await result2.text;

    console.log('\n\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('✅ Test 2 Results:');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`   Total chunks: ${chunkCount2}`);
    console.log(`   Tool calls detected: ${toolCallsDetected}`);
    console.log(`   Tool results detected: ${toolResultsDetected}`);
    console.log(`   Final text length: ${fullText2.length} chars`);
    console.log(`   Text: "${fullText2.substring(0, 100)}..."\n`);

    // Test 3: Direct API test
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('📊 Test 3: Direct API call (raw fetch)');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    console.log('🚀 Making direct API call...');
    const startTime = Date.now();

    const response = await fetch('https://api.neosantara.xyz/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${NEOSANTARA_API_KEY}`,
      },
      body: JSON.stringify({
        model: 'nusantara-base',
        messages: [
          {
            role: 'user',
            content: 'Say "Hello!" in one word.',
          },
        ],
        stream: false,
      }),
    });

    const elapsed = Date.now() - startTime;

    console.log(`✅ Response received in ${elapsed}ms`);
    console.log(`   Status: ${response.status} ${response.statusText}`);
    console.log(`   Content-Type: ${response.headers.get('content-type')}\n`);

    if (response.ok) {
      const data = await response.json();
      console.log('Response data:');
      console.log(JSON.stringify(data, null, 2));
    } else {
      const errorText = await response.text();
      console.log('❌ Error response:');
      console.log(errorText);
    }

    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('✅ All tests completed!');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  } catch (error) {
    console.error('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.error('❌ Test failed!');
    console.error('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.error('\nError:', error.message);

    if (error.cause) {
      console.error('\nCause:', error.cause);
    }

    if (error.stack) {
      console.error('\nStack trace:');
      console.error(error.stack);
    }

    process.exit(1);
  }
}

// Run test
testNeosantara();
