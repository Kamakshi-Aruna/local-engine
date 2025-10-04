# System Architecture & Flow Diagrams

## High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                      User Interface (Next.js)                   │
│  ┌──────────────┐  ┌──────────────┐  ┌───────────────────┐    │
│  │ Search Bar   │  │ Upload PDF   │  │ Results Display   │    │
│  └──────┬───────┘  └──────┬───────┘  └───────────────────┘    │
└─────────┼──────────────────┼───────────────────────────────────┘
          │                  │
          ▼                  ▼
┌─────────────────────────────────────────────────────────────────┐
│                        API Layer (Next.js)                      │
│  ┌────────────────┐  ┌────────────────┐  ┌────────────────┐   │
│  │/enhanced-search│  │  /upload-pdf   │  │  /delete-pdf   │   │
│  └────────┬───────┘  └────────┬───────┘  └────────────────┘   │
└──────────┼────────────────────┼────────────────────────────────┘
           │                    │
           ▼                    ▼
┌─────────────────────────────────────────────────────────────────┐
│                    AI Processing Layer                          │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐        │
│  │Query Expansion│  │  Embeddings  │  │  Re-ranking  │        │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘        │
└─────────┼──────────────────┼─────────────────┼─────────────────┘
          │                  │                 │
          └──────────┬───────┴─────────────────┘
                     ▼
        ┌───────────────────────────┐
        │   Ollama (Local LLM)     │
        │   - llama3 model         │
        │   - 4096-dim embeddings  │
        └────────────┬──────────────┘
                     │
                     ▼
        ┌───────────────────────────┐
        │   Qdrant Vector DB       │
        │   - Document storage      │
        │   - Similarity search     │
        └───────────────────────────┘
```

## Detailed Search Flow

```
USER SEARCH: "mobile developers"
        │
        ▼
┌──────────────────────────────────────────┐
│         1. QUERY EXPANSION                │
│                                           │
│  Input: "mobile developers"               │
│    ↓                                      │
│  LLM Analysis                            │
│    ↓                                      │
│  Output: ["mobile developers",           │
│           "iOS", "Android",              │
│           "React Native", "Swift",       │
│           "Kotlin", "Flutter"]           │
└──────────────────────────────────────────┘
        │
        ▼
┌──────────────────────────────────────────┐
│      2. MULTI-EMBEDDING GENERATION        │
│                                           │
│  embedding_1 = embed("mobile developers") │
│  embedding_2 = embed("iOS")              │
│  embedding_3 = embed("Android")          │
│                                           │
│  [4096-dimensional vectors]              │
└──────────────────────────────────────────┘
        │
        ▼
┌──────────────────────────────────────────┐
│         3. PARALLEL VECTOR SEARCH         │
│                                           │
│  ┌─────────┐  ┌─────────┐  ┌─────────┐  │
│  │Search 1 │  │Search 2 │  │Search 3 │  │
│  │Vec Sim  │  │Vec Sim  │  │Vec Sim  │  │
│  └────┬────┘  └────┬────┘  └────┬────┘  │
│       └────────────┼────────────┘        │
│                    ▼                     │
│         Combine & Deduplicate            │
└──────────────────────────────────────────┘
        │
        ▼
┌──────────────────────────────────────────┐
│         4. INTELLIGENT RE-RANKING         │
│                                           │
│  For each result:                        │
│    - Vector similarity: 0.82             │
│    - LLM relevance check: 0.95           │
│    - Final score: 0.91                   │
│                                           │
│  Sort by final scores                    │
└──────────────────────────────────────────┘
        │
        ▼
┌──────────────────────────────────────────┐
│      5. CONTEXT-AWARE RESPONSE           │
│                                           │
│  "Found 2 mobile developers:             │
│   1. John - iOS Developer (Swift, UIKit) │
│   2. Sarah - Android Dev (Kotlin, Java)" │
└──────────────────────────────────────────┘
```

## PDF Upload & Processing Flow

```
PDF FILE UPLOAD
      │
      ▼
┌────────────────┐
│  Extract Text  │ ← pdf-parse library
└────────┬───────┘
         │
         ▼
┌────────────────────────────┐
│     Text Chunking          │
│  ┌──────────────────────┐  │
│  │ Chunk 1 (500 chars)  │  │
│  │ Chunk 2 (500 chars)  │  │
│  │ Chunk 3 (500 chars)  │  │
│  └──────────────────────┘  │
└─────────┬──────────────────┘
          │
          ▼
┌──────────────────────────────────┐
│    Generate Embeddings           │
│                                  │
│  for each chunk:                 │
│    embedding = ollama.embed()    │
│    vector[4096]                  │
└─────────┬────────────────────────┘
          │
          ▼
┌──────────────────────────────────┐
│     Store in Qdrant              │
│                                  │
│  {                               │
│    id: 1001,                     │
│    vector: [0.1, 0.2, ...],     │
│    payload: {                    │
│      text: "chunk content",      │
│      source: "john_cv.pdf",      │
│      chunk_index: 1              │
│    }                             │
│  }                               │
└──────────────────────────────────┘
```

## Component Interaction Diagram

```
┌─────────────────────────────────────────────────────┐
│                   Frontend                          │
├─────────────────────────────────────────────────────┤
│  src/app/page.tsx                                   │
│    ↓                                                │
│  src/components/SearchBar.tsx  ←→  handleSearch()   │
│  src/components/UploadModal.tsx ←→ handleUpload()   │
│  src/components/AnswersArea.tsx ←→ displayResults() │
└──────────────────┬──────────────────────────────────┘
                   │ HTTP Requests
                   ▼
┌─────────────────────────────────────────────────────┐
│                   Backend                           │
├─────────────────────────────────────────────────────┤
│  src/app/api/enhanced-search/route.ts              │
│    ├── expandQueryWithLLM()                        │
│    ├── semanticSearchWithExpansion()               │
│    └── rerankResults()                             │
│                                                     │
│  src/app/api/upload-pdf/route.ts                   │
│    ├── PDF parsing                                 │
│    ├── Text chunking                               │
│    └── Embedding generation                        │
└──────────────────┬──────────────────────────────────┘
                   │
                   ▼
┌─────────────────────────────────────────────────────┐
│              Core Libraries                         │
├─────────────────────────────────────────────────────┤
│  src/lib/semanticSearch.ts                         │
│    - Query expansion logic                         │
│    - Multi-embedding generation                    │
│    - Result combination                            │
│                                                     │
│  src/lib/vectorStore.ts                           │
│    - Qdrant client configuration                   │
│    - Collection management                         │
└─────────────────────────────────────────────────────┘
```

## Data Flow Sequence

```
1. User Input
   ↓
2. Frontend Validation
   ↓
3. API Request
   ↓
4. Query Processing
   ├── Expansion
   ├── Embedding
   └── Search
   ↓
5. Vector Database
   ├── Similarity Search
   └── Return Matches
   ↓
6. Result Processing
   ├── Deduplication
   ├── Re-ranking
   └── Formatting
   ↓
7. Response Generation
   ↓
8. UI Update
```

## Technology Stack

```
┌──────────────────────────────┐
│         Frontend             │
│  • Next.js 14                │
│  • React 18                  │
│  • TypeScript                │
│  • Tailwind CSS              │
└──────────────────────────────┘
           │
┌──────────────────────────────┐
│         Backend              │
│  • Next.js API Routes        │
│  • Node.js Runtime           │
│  • TypeScript                │
└──────────────────────────────┘
           │
┌──────────────────────────────┐
│      AI/ML Layer             │
│  • Ollama (Local LLM)        │
│  • LlamaIndex                │
│  • 4096-dim Embeddings       │
└──────────────────────────────┘
           │
┌──────────────────────────────┐
│      Data Storage            │
│  • Qdrant Vector DB          │
│  • Cosine Similarity         │
│  • Persistent Storage        │
└──────────────────────────────┘
```

## Performance Metrics Flow

```
Query: "mobile developers"
        │
        ├── Query Expansion: 200ms
        │   └── LLM Processing
        │
        ├── Embedding Generation: 150ms
        │   └── 3 embeddings × 50ms
        │
        ├── Vector Search: 100ms
        │   └── Parallel searches
        │
        ├── Re-ranking: 300ms
        │   └── 5 results × 60ms
        │
        └── Total: ~750ms
```

## Error Handling Flow

```
Request
   │
   ├── Success → Process → Response
   │
   └── Error
       ├── No Documents → "Upload PDFs first"
       ├── LLM Error → Fallback to basic search
       ├── DB Error → Return error message
       └── Network Error → Retry with exponential backoff
```