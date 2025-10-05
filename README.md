# Simple AI-Powered Document Search

A beginner-friendly semantic search system using **Gemini AI embeddings** and **Cohere reranking** for intelligent document retrieval.

## 🚀 Features

- **2-Stage Search Pipeline**:
  1. **Gemini AI Text Embeddings** for semantic understanding
  2. **Cohere Rerank-v3** for improved search ranking

- **Free AI Services**: Uses Gemini AI (free tier) instead of paid OpenAI
- **Simple Architecture**: Easy to understand and modify
- **Query Expansion**: Automatically finds related terms
- **Smart Chunking**: Breaks documents into optimal sizes

## 🛠️ How It Works

```
PDF Upload → Text Extraction → Chunking → Gemini Embeddings → Vector Store
                                                                       ↓
User Query → Query Expansion → Gemini Embeddings → Vector Search → Cohere Rerank → Results
```

## 📋 Setup Instructions

### 1. Install Dependencies

```bash
npm install
```

### 2. Get API Keys (Both Free!)

**Gemini AI (Google):**
1. Visit [Google AI Studio](https://makersuite.google.com/app/apikey)
2. Create a free API key

**Cohere:**
1. Visit [Cohere Dashboard](https://dashboard.cohere.ai/api-keys)
2. Sign up and get a free API key

### 3. Environment Setup

Create `.env.local`:

```env
GEMINI_API_KEY=your_gemini_api_key_here
COHERE_API_KEY=your_cohere_api_key_here
```

### 4. Run the Application

```bash
npm run dev
```

Visit `http://localhost:3000`

## 🔧 Key Components

### `embeddingService.ts`
- Handles Gemini AI embeddings
- Simple in-memory vector storage
- Query expansion using Gemini

### `cohereReranker.ts`
- Reranks search results using Cohere
- Improves relevance scoring

### `semanticSearch.ts`
- Main search orchestration
- Combines embeddings + reranking
- Multiple search modes (basic/enhanced/reranked)

## 📊 Search Modes

1. **Basic**: Simple embedding similarity
2. **Enhanced**: With query expansion
3. **Reranked**: Enhanced + Cohere reranking (recommended)

## 🎯 For Beginners

This implementation is designed to be:
- **Simple**: Clear, commented code
- **Free**: No paid services required
- **Educational**: Easy to understand concepts
- **Extensible**: Can be enhanced with real databases

## 🔄 Upgrade Path

For production use, consider:
- Replace in-memory storage with a proper vector database (Pinecone, Weaviate, etc.)
- Add user authentication
- Implement caching
- Add more document types

## 🤝 Contributing

Feel free to submit issues and enhancement requests!

## 📝 License

MIT License - feel free to use and modify!