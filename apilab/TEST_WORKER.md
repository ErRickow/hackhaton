# 🔍 Testing Cloudflare Worker Endpoints

## Worker URL
`https://apilab-mcp-api.apinya.workers.dev/`

## Issue Detected: 403 Forbidden

### Test 1: Health Endpoint
```bash
curl https://apilab-mcp-api.apinya.workers.dev/health
```

**Result:** ❌ 403 Forbidden

### Possible Causes:

1. **CORS Configuration**
   - Worker might be blocking external requests
   - Need to verify CORS headers in worker/index.ts

2. **Route Configuration**
   - wrangler.toml might not have routes configured
   - Worker might not be publicly accessible

3. **Authentication Required**
   - Worker might require authentication even for /health

4. **Cloudflare Settings**
   - WAF (Web Application Firewall) blocking requests
   - IP restrictions
   - Zone lockdown rules

### Debug Steps:

#### 1. Check wrangler.toml Configuration
```toml
# Should have:
workers_dev = true  # Enable workers.dev subdomain
```

#### 2. Check Worker CORS Headers
```typescript
// In worker/index.ts
function corsResponse(body: any, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',  // Should allow all origins
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    },
  });
}
```

#### 3. Test Locally First
```bash
# Test local worker
cd worker
wrangler dev

# Then test:
curl http://localhost:8787/health
```

## Frontend Issue: Loading Stops But MCP Not Ready

### Problem
1. Loading indicator shows
2. Loading indicator disappears
3. MCP status never becomes "Ready"
4. No error message shown

### Possible Causes:

1. **Silent Error** - Error thrown but not displayed
2. **Backend Connection Fails** - 403 error from Worker
3. **Timeout** - Backend takes too long, frontend gives up
4. **State Management** - `setIsStarting(false)` called too early

### Debug in Browser Console:

Open browser DevTools and look for:

```javascript
// Should see these logs:
🚀 Starting E2B MCP via Backend API
🔑 Checking API keys...
   E2B API key: ✅ Found
   Backend URL: ✅ https://apilab-mcp-api.apinya.workers.dev

📡 Step 1: Calling backend API...

// If you see this, backend returned error:
❌ Backend API Error: {status: 403, ...}

// Or if backend times out:
❌ Failed to fetch
```

## Solutions:

### For 403 Error:

**Option 1: Check Cloudflare Dashboard**
1. Go to Cloudflare Dashboard
2. Workers & Pages
3. Find `apilab-mcp-api`
4. Check Settings → Security
5. Disable any IP restrictions or WAF rules

**Option 2: Redeploy Worker**
```bash
cd worker
wrangler deploy
```

**Option 3: Test with Different URL**
Try using local backend first:
```
Settings → Backend URL → http://localhost:3001
```

### For Loading Stops Issue:

**Improved Error Display:**
- Added better error logging
- Error now shows full details (status code, response)
- Error state persists in UI

**Testing:**
1. Open browser console
2. Click Settings
3. Add Backend URL: `https://apilab-mcp-api.apinya.workers.dev`
4. Add E2B API key
5. Watch console for detailed error logs

## Recommended Next Steps:

1. **Test Local Backend First**
   ```bash
   cd /home/user/hackhaton/apilab
   pnpm dev:all
   ```
   - Frontend: http://localhost:5173
   - Backend: http://localhost:3001
   - Settings → Backend URL: `http://localhost:3001`

2. **Debug Worker Separately**
   ```bash
   cd worker
   wrangler dev
   # Test: curl http://localhost:8787/health
   ```

3. **Check Cloudflare Logs**
   ```bash
   wrangler tail
   # See real-time logs from deployed worker
   ```

4. **Verify E2B API Key**
   - Make sure E2B API key is valid
   - Check E2B dashboard for sandbox creation errors

## Expected Behavior:

### Success Flow:
```
1. Click Settings ✅
2. Add Backend URL ✅
3. Add E2B API key ✅
4. Click Save
5. See "Restarting..." ✅
6. See console logs:
   🚀 Starting E2B MCP...
   📡 Step 1: Calling backend... ✅
   ✅ Backend API returned sandbox info!
   📡 Step 2: Waiting for MCP gateway... ✅
   ✅ MCP Gateway Ready!
7. Status shows "Ready" with green dot ✅
```

### Error Flow (Current):
```
1. Click Settings ✅
2. Add Backend URL ✅
3. Add E2B API key ✅
4. Click Save
5. See "Restarting..." ✅
6. See console logs:
   🚀 Starting E2B MCP...
   📡 Step 1: Calling backend...
   ❌ Backend API Error: 403 Forbidden ❌
7. Loading stops ❌
8. No "Ready" status ❌
9. Error shown in UI (with new fix) ✅
```
