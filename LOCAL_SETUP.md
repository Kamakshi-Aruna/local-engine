# Local Search Engine Setup

A completely local RAG (Retrieval-Augmented Generation) search engine using:
- **Ollama** (Local LLM)
- **Qdrant** (Local Vector Database)
- **LlamaIndex** (Document Processing)
- **Next.js** (Web Interface)

## Prerequisites

### 1. Install Ollama
```bash
# macOS
brew install ollama

# Start Ollama service
ollama serve

# Pull the required model
ollama pull llama3
```

### 2. Install Docker (for Qdrant)
```bash
# Install Docker Desktop or use brew
brew install docker
```

## Setup Instructions

### 1. Clone and Install Dependencies
```bash
cd local-engine
npm install
```

### 2. Start Local Qdrant Vector Database
```bash
# Start Qdrant in Docker
docker run -p 6333:6333 -p 6334:6334 \
  -v $(pwd)/qdrant_storage:/qdrant/storage \
  qdrant/qdrant
```

### 3. Verify Services are Running
```bash
# Check Ollama
curl http://localhost:11434/api/tags

# Check Qdrant
curl http://localhost:6333/collections
```

### 4. Add PDF Documents
```bash
# Put your PDF files in the data directory
cp your-documents.pdf ./data/
```

### 5. Ingest Documents
```bash
# Run the ingestion script
npm run ingest
```

### 6. Start the Web Application
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
# Ollama Configuration (local)
OLLAMA_BASE_URL=http://localhost:11434
OLLAMA_MODEL=llama3

# Qdrant Local Configuration
QDRANT_URL=http://localhost:6333
QDRANT_COLLECTION=pdf_documents
```

## Architecture

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Next.js App   │───▶│   Ollama LLM    │    │   Qdrant DB     │
│  (localhost:3000)│    │ (localhost:11434)│    │ (localhost:6333)│
└─────────────────┘    └─────────────────┘    └─────────────────┘
         │                       │                       │
         │                       ▼                       │
         │              Generate Embeddings              │
         │                       │                       │
         └───────────────────────┼───────────────────────┘
                                 ▼
                        Store/Search Vectors
```

## Troubleshooting

### Ollama Issues
```bash
# Restart Ollama
pkill ollama
ollama serve

# Check model availability
ollama list
```

### Qdrant Issues
```bash
# Restart Qdrant container
docker ps  # find container ID
docker restart <container_id>

# Check Qdrant dashboard
open http://localhost:6333/dashboard
```

### Port Conflicts
- Ollama: Default port 11434
- Qdrant: Default ports 6333, 6334
- Next.js: Default port 3000

## Features

- ✅ 100% Local - No external API calls
- ✅ PDF Document Ingestion
- ✅ Semantic Search
- ✅ Vector Storage with Qdrant
- ✅ LLM-powered Responses with Ollama
- ✅ Web Interface with Next.js
- ✅ TypeScript Support

## File Structure

```
local-engine/
├── src/
│   ├── app/api/
│   │   ├── search/route.ts      # Search API endpoint
│   │   └── upload-pdf/route.ts  # PDF upload endpoint
│   └── lib/
│       └── vectorStore.ts       # Qdrant client configuration
├── scripts/
│   └── ingest.ts               # Bulk PDF ingestion script
├── data/                       # PDF documents directory
├── qdrant_storage/            # Qdrant data persistence
└── .env.local                 # Local configuration
```