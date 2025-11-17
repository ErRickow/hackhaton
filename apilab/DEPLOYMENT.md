# 🚀 Deployment Guide - APILab Hackathon

Guide lengkap untuk deploy APILab dengan **GRATIS** dan **MUDAH**!

## 📋 Deployment Strategy

| Component | Platform | Cost | Setup Time |
|-----------|----------|------|------------|
| **Backend API** | Cloudflare Workers | FREE ✅ | 5 mins |
| **Frontend** | GitHub Pages | FREE ✅ | 2 mins |

---

## 🔧 Backend: Deploy ke Cloudflare Workers

### Step 1: Install Cloudflare CLI (Wrangler)

```bash
# Install wrangler globally
npm install -g wrangler

# Login ke Cloudflare
wrangler login
```

Browser akan terbuka, login dengan Cloudflare account (gratis).

### Step 2: Deploy Worker

```bash
cd worker
npm install
wrangler deploy
```

Output akan menunjukkan URL worker Anda:
```
✨ Published apilab-mcp-api
   https://apilab-mcp-api.<your-subdomain>.workers.dev
```

**Copy URL ini!** Ini adalah backend API URL Anda.

### Step 3: Test Worker

```bash
# Health check
curl https://apilab-mcp-api.<your-subdomain>.workers.dev/health

# Should return:
{"status":"ok","timestamp":"..."}
```

✅ **Backend DONE!**

---

## 🎨 Frontend: Deploy ke GitHub Pages

### Step 1: Update API URL

Edit `.env.production`:

```bash
# Create .env.production
cat > .env.production << EOF
VITE_API_URL=https://apilab-mcp-api.<your-subdomain>.workers.dev
EOF
```

Ganti `<your-subdomain>` dengan subdomain dari Cloudflare Worker Anda!

### Step 2: Build Frontend

```bash
# Build production
pnpm build

# Output akan ada di folder dist/
```

### Step 3: Deploy ke GitHub Pages

#### Option A: Manual (Mudah!)

```bash
# Install gh-pages
pnpm add -D gh-pages

# Add deploy script ke package.json
# Sudah ada di "scripts": { "deploy": "gh-pages -d dist" }

# Deploy!
pnpm run deploy
```

#### Option B: GitHub Actions (Otomatis!)

File `.github/workflows/deploy.yml` sudah disediakan. Tinggal push ke GitHub:

```bash
git add .
git commit -m "Ready for deployment"
git push origin main
```

GitHub Actions akan auto-deploy ke:
```
https://<username>.github.io/hackhaton/
```

### Step 4: Enable GitHub Pages

1. Buka repo di GitHub
2. Settings → Pages
3. Source: `gh-pages` branch
4. Save

✅ **Frontend DONE!**

---

## 🧪 Testing Deployed App

### 1. Open Frontend
```
https://<username>.github.io/hackhaton/
```

### 2. Input API Keys
- Click **Settings** icon
- Input **E2B API Key** (dari https://e2b.dev)
- Input **Neosantara** atau **Groq API Key**
- Click **Save**

### 3. Test Chat
Send message:
```
Search for latest news about AI hackathons
```

Check browser console untuk logs:
```
🚀 Starting E2B MCP via Backend API
📡 Calling backend API...
✅ Backend API returned sandbox info!
🔌 Creating MCP client...
✅ MCP client connected!
✅ Tools loaded successfully!
```

---

## 🎯 Quick Commands Cheat Sheet

### Development
```bash
# Local development
pnpm dev:all

# Frontend only
pnpm dev

# Backend only (Worker local)
cd worker && wrangler dev
```

### Deployment
```bash
# Deploy backend (Cloudflare Workers)
cd worker && wrangler deploy

# Deploy frontend (GitHub Pages)
pnpm build && pnpm run deploy
```

### Debugging
```bash
# Check worker logs
cd worker && wrangler tail

# Check frontend build
pnpm build && pnpm preview
```

---

## 💰 Cost Breakdown (Hackathon Gratis!)

### Cloudflare Workers FREE Tier:
- ✅ **100,000 requests/day**
- ✅ **Global edge network**
- ✅ **No credit card required**
- ✅ **Instant deployment**

### GitHub Pages FREE Tier:
- ✅ **Unlimited static sites**
- ✅ **100 GB bandwidth/month**
- ✅ **Custom domain support**
- ✅ **Auto SSL certificate**

**Total cost: $0/month** 🎉

---

## 🔒 Security Best Practices

### For Hackathon (Quick & Easy):
- ✅ E2B API key input via UI (localStorage)
- ✅ API key sent from frontend ke worker
- ✅ CORS enabled untuk GitHub Pages domain

### For Production (Recommended):
```bash
# Store E2B API key as Worker secret
wrangler secret put E2B_API_KEY

# Update worker code to use env.E2B_API_KEY
# Update frontend to not send apiKey in request body
```

---

## ⚡ Performance Tips

### Cloudflare Workers:
- Deployed di **300+ edge locations** worldwide
- **<50ms** latency dari user ke backend
- Auto-scaling sampai **1M+ requests**

### GitHub Pages:
- CDN caching otomatis
- Gzip compression enabled
- HTTP/2 support

---

## 🐛 Troubleshooting

### Error: "Failed to fetch"
**Fix**: Check CORS settings di worker & update VITE_API_URL

### Error: "Worker exceeded CPU time limit"
**Fix**: E2B sandbox creation bisa lama (30-60s), tapi hanya sekali per session

### Error: "GitHub Pages 404"
**Fix**: Pastikan gh-pages branch exist & enabled di Settings

---

## 📚 Useful Links

- **Cloudflare Workers Docs**: https://developers.cloudflare.com/workers/
- **GitHub Pages Docs**: https://docs.github.com/pages
- **E2B Docs**: https://e2b.dev/docs
- **Wrangler CLI**: https://developers.cloudflare.com/workers/wrangler/

---

## 🎉 Ready for Hackathon!

Deployment time: **~10 minutes**
Total cost: **$0**
Global availability: **✅**
SSL Certificate: **✅**
Auto-scaling: **✅**

**Demo URL** (update dengan yours):
```
Frontend: https://<username>.github.io/hackhaton/
Backend:  https://apilab-mcp-api.<subdomain>.workers.dev
```

Good luck! 🚀
