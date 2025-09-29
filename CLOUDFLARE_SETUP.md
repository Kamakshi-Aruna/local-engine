# Cloudflare Setup Guide

## Complete Step-by-Step Process for Beginners

### Step 1: Cloudflare Account Setup

1. **Create Account**
   - Go to [cloudflare.com](https://cloudflare.com)
   - Click "Sign Up"
   - Enter email and create password
   - Verify email address

2. **Get Account ID**
   - After login, go to the right sidebar
   - Copy your "Account ID" (save it for later)

3. **Create API Token**
   - Go to "My Profile" → "API Tokens"
   - Click "Create Token"
   - Use "Custom token" template
   - **Permissions**:
     - Account: Cloudflare Workers:Edit
     - Zone: Zone:Edit (if you have domains)
   - **Account Resources**: Include: Your Account
   - Click "Continue to summary" → "Create Token"
   - **IMPORTANT**: Copy the token immediately (save it securely)

### Step 2: Install Wrangler CLI

```bash
# Install Wrangler globally
npm install -g wrangler

# Login to Cloudflare
wrangler login

# If login fails, use your API token
wrangler auth token <your-api-token-here>
```

### Step 3: Create Vectorize Index

```bash
# Navigate to your project
cd /Users/arunakamakshi/local-engine

# Create the vector database index
wrangler vectorize create pdf-search-index --dimensions=768 --metric=cosine
```

**Expected output:**
```
✅ Successfully created index 'pdf-search-index'
```

### Step 4: Configure Environment Variables

Update your `.env.local` file with your actual Cloudflare credentials:

```env
# Replace with your actual values
CLOUDFLARE_ACCOUNT_ID=your-account-id-here
CLOUDFLARE_API_TOKEN=your-api-token-here
CLOUDFLARE_WORKER_URL=https://local-engine-worker.your-subdomain.workers.dev
VECTORIZE_INDEX_NAME=pdf-search-index
```

**How to find your values:**
- `CLOUDFLARE_ACCOUNT_ID`: From Cloudflare dashboard right sidebar
- `CLOUDFLARE_API_TOKEN`: The token you created in Step 1
- `CLOUDFLARE_WORKER_URL`: You'll get this after deploying (Step 6)

### Step 5: Deploy the Cloudflare Worker

```bash
# Deploy the worker
npm run deploy-worker
```

**Expected output:**
```
✅ Deployed successfully!
🌍 Your worker is available at: https://local-engine-worker.your-subdomain.workers.dev
```

**Copy the URL** from the output and update your `.env.local` file.

### Step 6: Test Your Setup

```bash
# Test that everything is working
curl -X POST "https://your-worker-url/search" \
  -H "Content-Type: application/json" \
  -d '{"query": "test"}'
```

**Expected response:**
```json
{
  "success": true,
  "answer": "I couldn't find any relevant information for your query.",
  "query": "test",
  "sources": []
}
```

### Step 7: Migrate Existing Data (Optional)

If you have existing data in Qdrant:

```bash
# Make sure your local Qdrant is running
docker run -p 6333:6333 qdrant/qdrant

# Run migration script
npm run migrate-to-cloudflare
```

### Step 8: Update API Routes

To switch from local to Cloudflare, update your API imports:

**Option 1: Replace existing routes**
```bash
# Replace search route
mv src/app/api/search/route.ts src/app/api/search/route.local.ts
mv src/app/api/search/cloudflare-route.ts src/app/api/search/route.ts

# Replace upload route
mv src/app/api/upload-pdf/route.ts src/app/api/upload-pdf/route.local.ts
mv src/app/api/upload-pdf/cloudflare-route.ts src/app/api/upload-pdf/route.ts
```

**Option 2: Use environment variable switching** (recommended)

Update `src/app/api/search/route.ts`:
```typescript
import { NextRequest, NextResponse } from "next/server";

// Dynamic import based on environment
const useCloudflare = process.env.CLOUDFLARE_WORKER_URL;

export async function POST(request: NextRequest) {
  if (useCloudflare) {
    // Use Cloudflare implementation
    const { POST: CloudflarePOST } = await import('./cloudflare-route');
    return CloudflarePOST(request);
  } else {
    // Use local implementation (original code)
    // ... existing local implementation
  }
}
```

### Step 9: Test Your Application

```bash
# Start your Next.js app
npm run dev

# Test upload
curl -X POST http://localhost:3000/api/upload-pdf \
  -F "pdf=@./data/sample.pdf"

# Test search
curl -X POST http://localhost:3000/api/search \
  -H "Content-Type: application/json" \
  -d '{"query": "your search query"}'
```

## Troubleshooting

### Common Issues

1. **"Index not found" error**
   ```bash
   # Re-create the index
   wrangler vectorize delete pdf-search-index
   wrangler vectorize create pdf-search-index --dimensions=768 --metric=cosine
   ```

2. **"Worker not found" error**
   ```bash
   # Check deployment status
   wrangler deployments list

   # Re-deploy if needed
   npm run deploy-worker
   ```

3. **CORS errors in browser**
   - The worker includes CORS headers automatically
   - Make sure your worker URL is correct in `.env.local`

4. **Rate limiting errors**
   - Cloudflare free tier has limits
   - Add delays in batch processing
   - Consider upgrading to paid plan for production

### Monitoring

- **Worker logs**: `wrangler tail`
- **Vectorize status**: `wrangler vectorize get pdf-search-index`
- **API analytics**: Check Cloudflare dashboard

## Cost Comparison

| Service | Local | Cloudflare |
|---------|-------|------------|
| **LLM** | Free (self-hosted) | ~$0.01/1K tokens |
| **Vector DB** | Free (self-hosted) | Free tier: 30M queries/month |
| **Hosting** | Local only | Global CDN |
| **Maintenance** | Manual updates | Automatic |

## Next Steps

1. **Production Setup**
   - Add custom domain
   - Set up monitoring
   - Configure rate limiting

2. **Enhanced Features**
   - Add authentication
   - Implement caching
   - Add more AI models

3. **Scaling**
   - Use Cloudflare D1 for metadata
   - Add queue system for bulk uploads
   - Implement user management

## Architecture Comparison

### Before (Local)
```
┌─────────────┐    ┌─────────────┐    ┌─────────────┐
│  Next.js    │───▶│   Ollama    │    │   Qdrant    │
│ localhost   │    │ localhost   │    │ localhost   │
└─────────────┘    └─────────────┘    └─────────────┘
```

### After (Cloudflare)
```
┌─────────────┐    ┌─────────────────────────────────┐
│  Next.js    │───▶│        Cloudflare Edge          │
│ localhost   │    │  ┌─────────────┐ ┌─────────────┐ │
└─────────────┘    │  │ AI Workers  │ │ Vectorize   │ │
                   │  │     LLM     │ │ Vector DB   │ │
                   │  └─────────────┘ └─────────────┘ │
                   └─────────────────────────────────┘
```

## Benefits of Migration

✅ **Global Performance**: CDN-powered responses worldwide
✅ **Zero Maintenance**: No local services to manage
✅ **Automatic Scaling**: Handles traffic spikes automatically
✅ **Built-in Security**: HTTPS, DDoS protection included
✅ **Cost Effective**: Pay only for usage
✅ **High Availability**: 99.9%+ uptime SLA

Your local search engine is now powered by Cloudflare's global infrastructure! 🚀