/**
 * Simple Neosantara API Test (No dependencies)
 *
 * Usage: node test-neosantara-simple.mjs
 */

const NEOSANTARA_API_KEY = 'naipencak_silat-95dc74625206413b-2549';
const NEOSANTARA_URL = 'https://api.neosantara.xyz/v1/chat/completions';

console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('🧪 Testing Neosantara API');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

async function testNeosantara() {
  try {
    console.log('📝 Configuration:');
    console.log(`   API Key: ${NEOSANTARA_API_KEY.substring(0, 20)}...`);
    console.log(`   URL: ${NEOSANTARA_URL}`);
    console.log(`   Model: nusantara-base\n`);

    // Test 1: Non-streaming request
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('📊 Test 1: Non-streaming chat completion');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    const startTime1 = Date.now();
    console.log('🚀 Sending request...');

    const response1 = await fetch(NEOSANTARA_URL, {
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
            content: 'Halo! Ceritakan tentang Indonesia dalam 1 kalimat pendek.',
          },
        ],
        stream: false,
        max_tokens: 100,
      }),
    });

    const elapsed1 = Date.now() - startTime1;

    console.log(`✅ Response received in ${elapsed1}ms`);
    console.log(`   Status: ${response1.status} ${response1.statusText}`);
    console.log(`   Content-Type: ${response1.headers.get('content-type')}\n`);

    if (response1.ok) {
      const data = await response1.json();
      console.log('✅ SUCCESS! Response:');
      console.log(JSON.stringify(data, null, 2));

      if (data.choices && data.choices[0]) {
        console.log('\n📝 Generated text:');
        console.log(`   "${data.choices[0].message.content}"\n`);
      }
    } else {
      const errorText = await response1.text();
      console.log('❌ API Error:');
      console.log(errorText);
      throw new Error(`API returned ${response1.status}: ${errorText}`);
    }

    // Test 2: Streaming request
    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('📊 Test 2: Streaming chat completion');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    const startTime2 = Date.now();
    console.log('🚀 Sending streaming request...');

    const response2 = await fetch(NEOSANTARA_URL, {
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
            content: 'Sebutkan 3 kota besar di Indonesia.',
          },
        ],
        stream: true,
        max_tokens: 100,
      }),
    });

    console.log(`✅ Stream started`);
    console.log(`   Status: ${response2.status} ${response2.statusText}`);
    console.log(`   Content-Type: ${response2.headers.get('content-type')}\n`);

    if (!response2.ok) {
      const errorText = await response2.text();
      console.log('❌ API Error:');
      console.log(errorText);
      throw new Error(`API returned ${response2.status}: ${errorText}`);
    }

    console.log('📡 Streaming response:\n');
    let chunkCount = 0;
    let fullText = '';

    const reader = response2.body.getReader();
    const decoder = new TextDecoder();

    while (true) {
      const { done, value } = await reader.read();

      if (done) {
        break;
      }

      chunkCount++;
      const chunk = decoder.decode(value, { stream: true });

      // Parse SSE format
      const lines = chunk.split('\n');
      for (const line of lines) {
        if (line.startsWith('data: ')) {
          const data = line.substring(6);

          if (data === '[DONE]') {
            continue;
          }

          try {
            const json = JSON.parse(data);
            const content = json.choices?.[0]?.delta?.content;
            if (content) {
              process.stdout.write(content);
              fullText += content;
            }
          } catch (e) {
            // Skip invalid JSON
          }
        }
      }
    }

    const elapsed2 = Date.now() - startTime2;

    console.log('\n\n✅ Stream completed!');
    console.log(`   Duration: ${elapsed2}ms`);
    console.log(`   Chunks received: ${chunkCount}`);
    console.log(`   Total text length: ${fullText.length} chars\n`);

    // Test 3: With function calling
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('📊 Test 3: Function calling test');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    console.log('🚀 Sending request with function calling...');

    const response3 = await fetch(NEOSANTARA_URL, {
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
            content: 'What is the weather in Jakarta?',
          },
        ],
        tools: [
          {
            type: 'function',
            function: {
              name: 'get_weather',
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
            },
          },
        ],
        stream: false,
      }),
    });

    console.log(`✅ Response received`);
    console.log(`   Status: ${response3.status} ${response3.statusText}\n`);

    if (response3.ok) {
      const data = await response3.json();
      console.log('✅ Function calling response:');
      console.log(JSON.stringify(data, null, 2));

      if (data.choices?.[0]?.message?.tool_calls) {
        console.log('\n🔧 Tool calls detected:');
        data.choices[0].message.tool_calls.forEach((tc, i) => {
          console.log(`   ${i + 1}. ${tc.function.name}(${tc.function.arguments})`);
        });
      } else {
        console.log('\n⚠️ No tool calls - model replied with text instead');
      }
    } else {
      const errorText = await response3.text();
      console.log('❌ API Error:');
      console.log(errorText);
    }

    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('✅ All tests completed successfully!');
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
