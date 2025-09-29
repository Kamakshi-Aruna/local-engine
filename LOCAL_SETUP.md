# Cloudflare Search Engine Setup

A cloud-powered RAG (Retrieval-Augmented Generation) search engine using:
- **Cloudflare AI Workers** (Cloud LLM)
- **Cloudflare Vectorize** (Cloud Vector Database)
- **Next.js** (Web Interface)

## Prerequisites

### 1. Cloudflare Account
- Sign up at [cloudflare.com](https://cloudflare.com)
- Get your Account ID and API Token

### 2. Install Wrangler CLI
```bash
# Install Wrangler globally
npm install -g wrangler

# Login to Cloudflare
wrangler login
```

## Setup Instructions

### 1. Clone and Install Dependencies
```bash
cd local-engine
npm install
```

### 2. Create Cloudflare Vectorize Index
```bash
# Create vector database
npm run create-vectorize
```

### 3. Deploy Cloudflare Worker
```bash
# Deploy AI worker to Cloudflare
npm run deploy-worker
```

### 4. Configure Environment
Update `.env.local` with your Cloudflare credentials:
```env
CLOUDFLARE_ACCOUNT_ID=your-account-id
CLOUDFLARE_API_TOKEN=your-api-token
CLOUDFLARE_WORKER_URL=https://your-worker.workers.dev
VECTORIZE_INDEX_NAME=pdf-search-index
```

### 5. Start the Web Application
```bash
# Start Next.js application
npm run dev
```

## Usage

### Upload PDFs via API
```bash
curl -X POST http://localhost:3000/api/upload-pdf \
  -F "pdf=@./data/your-document.pdf"
```

### Search Documents
```bash
curl -X POST http://localhost:3000/api/search \
  -H "Content-Type: application/json" \
  -d '{"query": "your search query"}'
```

### Web Interface
Open `http://localhost:3000` in your browser for the web interface.

## Configuration

All configuration is in `.env.local`:
```env
# Cloudflare Configuration
CLOUDFLARE_ACCOUNT_ID=your-account-id
CLOUDFLARE_API_TOKEN=your-api-token
CLOUDFLARE_WORKER_URL=https://your-worker.workers.dev
VECTORIZE_INDEX_NAME=pdf-search-index
```

## Architecture

```
┌─────────────────┐    ┌─────────────────────────────────┐
│   Next.js App   │───▶│        Cloudflare Edge          │
│  (localhost:3000)│    │  ┌─────────────┐ ┌─────────────┐ │
└─────────────────┘    │  │ AI Workers  │ │ Vectorize   │ │
                       │  │     LLM     │ │ Vector DB   │ │
                       │  └─────────────┘ └─────────────┘ │
                       └─────────────────────────────────┘
```

## Troubleshooting

### Worker Issues
```bash
# Check worker status
wrangler deployments list

# View worker logs
wrangler tail

# Re-deploy worker
npm run deploy-worker
```

### Vectorize Issues
```bash
# Check vectorize status
wrangler vectorize get pdf-search-index

# Re-create index if needed
wrangler vectorize delete pdf-search-index
npm run create-vectorize
```

### Environment Issues
- Ensure all environment variables are set correctly
- Worker URL should end with `.workers.dev`
- Account ID and API Token must be valid

## Features

- ✅ Global CDN - Responses from 300+ locations worldwide
- ✅ PDF Document Ingestion
- ✅ Semantic Search with AI
- ✅ Vector Storage with Cloudflare Vectorize
- ✅ LLM-powered Responses with Cloudflare AI
- ✅ Web Interface with Next.js
- ✅ TypeScript Support
- ✅ Zero maintenance - No local services

## File Structure

```
local-engine/
├── src/
│   ├── app/api/
│   │   ├── search/route.ts      # Cloudflare search API
│   │   └── upload-pdf/route.ts  # Cloudflare upload API
│   ├── lib/
│   │   └── cloudflareVectorStore.ts  # Vectorize client
│   └── worker.ts               # Cloudflare Worker
├── wrangler.toml               # Worker configuration
└── .env.local                  # Cloudflare configuration
```