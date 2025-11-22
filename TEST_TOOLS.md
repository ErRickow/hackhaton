# Tool Calling Test Scripts

Test scripts untuk verify bahwa Neosantara API dan MCP Worker dapat call tools dengan benar.

## Prerequisites

Install dependencies di root folder:

```bash
npm install @ai-sdk/openai ai zod
```

## Test 1: MCP Worker API (Backend Only)

Test apakah worker backend berfungsi dengan benar (tanpa melibatkan Neosantara):

```bash
# Set your E2B API key
export E2B_API_KEY="your_e2b_api_key_here"

# Optional: custom backend URL
export BACKEND_URL="https://apilab-mcp-api.apinya.workers.dev"

# Run test
node test-mcp-worker.mjs
```

**Expected output jika berhasil:**
```
✅ All tests passed! Worker API is working correctly.
```

**Test ini akan:**
1. Initialize E2B sandbox via worker
2. Get list of available tools
3. Call duckduckgo_search tool dengan query "AI news"

---

## Test 2: Neosantara + Tool Calling (Full Integration)

Test apakah Neosantara API dapat memanggil tools (hardcoded + MCP):

```bash
# Set your API keys
export NEOSANTARA_API_KEY="your_neosantara_key_here"
export E2B_API_KEY="your_e2b_api_key_here"  # Optional, for MCP test

# Optional: custom backend URL
export BACKEND_URL="https://apilab-mcp-api.apinya.workers.dev"

# Run test
node test-neosantara-tools.mjs
```

**Expected output jika berhasil:**
```
Test 1 (Hardcoded Tool): ✅ PASS
Test 2 (MCP Backend):     ✅ PASS
```

**Test ini akan:**
1. Test simple hardcoded tool (baseline)
2. Test MCP worker backend tool (full integration)

---

## Debugging Guide

### Jika Test 1 gagal (Worker API)

❌ **Problem:** Worker backend tidak berfungsi

**Check:**
- E2B API key valid?
- Worker deployed dengan benar?
- Backend URL correct?
- Check worker logs di Cloudflare dashboard

### Jika Test 1 pass, Test 2.1 gagal (Hardcoded tool)

❌ **Problem:** Neosantara API tidak bisa call tools sama sekali

**Kemungkinan:**
- Model "nusantara-base" tidak support function calling
- API key tidak punya akses function calling
- Tool format incompatible dengan Neosantara

**Solusi:**
- Coba model lain (jika tersedia)
- Confirm dengan Neosantara support tentang function calling
- Check dokumentasi Neosantara untuk tool format

### Jika Test 2.1 pass, Test 2.2 gagal (MCP tool)

⚠️ **Problem:** Tool calling bekerja, tapi MCP integration bermasalah

**Kemungkinan:**
- Schema conversion dari MCP ke AI SDK format tidak tepat
- Backend response format tidak sesuai
- Tool description tidak jelas untuk LLM

**Solusi:**
- Check console logs untuk schema conversion
- Verify backend response structure
- Improve tool descriptions

### Jika semua test pass tapi app masih gagal

✅ **Backend OK, Neosantara OK, Tools OK** → Problem di app configuration

**Check:**
- API keys di app settings sama dengan test?
- System prompt di app terlalu restrictive?
- Tools object passed dengan benar ke streamText?
- Check browser console untuk errors

---

## Manual Testing in App

Setelah test scripts pass, test di app dengan commands:

1. **Test hardcoded tool:**
   ```
   what time is it?
   ```
   Should call `test_tool`

2. **Test MCP search:**
   ```
   search for latest AI news
   ```
   Should call `duckduckgo_search`

3. **Test MCP arxiv:**
   ```
   find papers about machine learning
   ```
   Should call `arxiv`

---

## Expected Tool Execution Flow

Ketika tools bekerja dengan benar, Anda akan melihat:

1. User mengetik perintah
2. AI mengenali bahwa perlu call tool
3. Purple separator muncul: "Tool Executions"
4. Tool execution card muncul dengan:
   - Tool name
   - Status: Running → Complete
   - Arguments
   - Result
5. AI memberikan response berdasarkan **real data** dari tool

---

## Troubleshooting Commands

```bash
# Check if dependencies installed
node -e "import('@ai-sdk/openai').then(() => console.log('✓ @ai-sdk/openai OK'))"
node -e "import('ai').then(() => console.log('✓ ai OK'))"
node -e "import('zod').then(() => console.log('✓ zod OK'))"

# Test worker with curl
curl -X POST https://apilab-mcp-api.apinya.workers.dev/api/mcp/init \
  -H "Content-Type: application/json" \
  -d '{"apiKey":"YOUR_E2B_KEY","mcpServers":{"duckduckgo":{}}}'

# Get package versions
npm list @ai-sdk/openai ai zod
```
