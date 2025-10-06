# Semantic CV Search - Local Implementation

## Overview

This is a semantic search system that demonstrates **relevance search with indirect information matching**. The system can understand queries like "top 5 mobile developers" and correctly match CVs containing iOS, Android, Flutter, or React Native skills - even though those CVs never explicitly mention "mobile" or "developer".

## How It Works

### 1. **Vector Embeddings for Semantic Understanding**
- CVs are converted to vector embeddings using Ollama (local LLM)
- Search queries are also embedded into the same vector space
- Similar concepts cluster together (e.g., "iOS developer" is close to "mobile developer")

### 2. **Cosine Similarity Search**
- Qdrant vector database performs cosine similarity search
- Finds CVs whose embeddings are closest to the query embedding
- Returns results ranked by similarity score

### 3. **LLM-Powered Result Analysis**
- The LLM analyzes retrieved CVs to explain why they match
- Understands implicit relationships (Swift → iOS → Mobile)
- Provides intelligent ranking and explanations

## Architecture

```
Query: "top 5 mobile developers"
    ↓
[Ollama Embedding] → Vector representation
    ↓
[Qdrant Vector Search] → Find similar CV embeddings
    ↓
[Ollama LLM Analysis] → Explain relevance & rank
    ↓
Results: iOS, Android, Flutter, React Native developers
```

## Setup Instructions

### Prerequisites

1. **Ollama** (Local LLM)
   ```bash
   # Install Ollama
   curl -fsSL https://ollama.com/install.sh | sh

   # Pull the model
   ollama pull llama3

   # Verify it's running
   ollama list
   ```

2. **Qdrant** (Local Vector Database)
   ```bash
   # Using Docker
   docker run -p 6333:6333 qdrant/qdrant

   # Or download binary from https://qdrant.tech/documentation/quick-start/
   ```

3. **Node.js** (v18+)
   ```bash
   node --version  # Should be 18+
   ```

### Installation

1. Install dependencies:
   ```bash
   npm install
   ```

2. Configure environment (already set in `.env.local`):
   ```bash
   OLLAMA_BASE_URL=http://localhost:11434
   OLLAMA_MODEL=llama3
   QDRANT_URL=http://localhost:6333
   QDRANT_COLLECTION=local-search
   ```

## Usage

### Step 1: Generate 20 Diverse CVs

```bash
npm run generate-cvs
```

This creates 20 CVs in different languages (English, Spanish, French, German, Italian) with various roles:
- **8 Mobile-related**: iOS, Android, Flutter, React Native developers
- **12 Other**: Backend, Frontend, Full-stack, DevOps engineers

**Key Point**: CVs only mention specific technologies (Swift, Kotlin, etc.), NOT generic terms like "mobile developer"

### Step 2: Ingest CVs into Qdrant

```bash
npm run ingest-cvs
```

This:
- Generates embeddings for each CV using Ollama
- Stores vectors in Qdrant's `local-search` collection
- Preserves metadata (language, profile type, etc.)

### Step 3: Start the Application

```bash
npm run dev
```

Visit: http://localhost:3000

### Step 4: Test Semantic Search

Try these queries to see indirect information matching:

1. **"Show me top 5 mobile developers"**
   - Should return: iOS, Android, Flutter, React Native developers
   - Even though CVs don't say "mobile"

2. **"Find iOS specialists"**
   - Returns: iOS developers (Swift, UIKit, Xcode)

3. **"Backend developers with API experience"**
   - Returns: Backend devs with Node.js, REST API, GraphQL

4. **"Developers who can build apps"**
   - Returns: Mobile developers (iOS, Android, Flutter)

## How Semantic Search Handles Indirect Information

### Example Query: "top 5 mobile developers"

1. **Query Embedding**:
   - "mobile developers" → Vector: [0.23, -0.45, 0.67, ...]

2. **CV Embeddings** (simplified):
   - CV with Swift, iOS → Vector: [0.25, -0.43, 0.65, ...] ← High similarity!
   - CV with Kotlin, Android → Vector: [0.24, -0.46, 0.64, ...] ← High similarity!
   - CV with Node.js, PostgreSQL → Vector: [-0.12, 0.33, -0.28, ...] ← Low similarity

3. **Why It Works**:
   - Language models understand that:
     - Swift + iOS development = Mobile development
     - Kotlin + Android SDK = Mobile development
     - Flutter + Dart = Mobile development
   - These relationships are encoded in the embedding space
   - No keyword matching needed!

4. **LLM Enhancement**:
   - After retrieval, the LLM explains: "This iOS developer is a mobile developer because they work with Swift and iOS SDK to build mobile applications"

## Technical Details

### Embeddings
- **Model**: Ollama llama3
- **Dimension**: 4096
- **Distance**: Cosine similarity

### Vector Database
- **Database**: Qdrant (local)
- **Collection**: `local-search`
- **Score Threshold**: 0.3 (configurable in search route)

### Search Flow
1. Generate query embedding (Ollama API)
2. Vector similarity search (Qdrant)
3. Retrieve top-N most similar CVs
4. LLM analyzes and ranks results
5. Return structured response with explanations

## Data Generated

- **Location**: `./cvs/` directory
- **Format**: Plain text (.txt)
- **Languages**: English, Spanish, French, German, Italian
- **Profiles**: 8 different developer types
- **Total**: 20 CVs

### CV Distribution:
- 2x iOS Developer
- 2x Android Developer
- 2x Flutter Developer
- 2x React Native Developer
- 3x Backend Developer
- 3x Frontend Developer
- 3x Full Stack Developer
- 3x DevOps Engineer

## API Endpoints

### POST `/api/search`
Search for CVs using semantic search

**Request**:
```json
{
  "query": "top 5 mobile developers"
}
```

**Response**:
```json
{
  "success": true,
  "query": "top 5 mobile developers",
  "answer": "LLM-generated analysis and ranking...",
  "candidates": [
    {
      "rank": 1,
      "file": "cv_01_ios_developer_english.txt",
      "profile_type": "ios_developer",
      "language": "english",
      "score": 0.87,
      "preview": "First 200 chars of CV..."
    }
  ]
}
```

## Customization

### Change Search Limit
In `/src/app/api/search/route.ts`:
```typescript
const searchLimit = topNMatch ? parseInt(topNMatch[1]) : 5; // Default 5
```

### Adjust Score Threshold
Lower threshold = more results (less strict):
```typescript
score_threshold: 0.3  // Range: 0.0 to 1.0
```

### Use Different LLM Model
```bash
# Pull a different model
ollama pull mistral

# Update .env.local
OLLAMA_MODEL=mistral
```

## Troubleshooting

### Ollama not responding
```bash
# Check if Ollama is running
curl http://localhost:11434/api/tags

# Restart Ollama
pkill ollama
ollama serve
```

### Qdrant connection error
```bash
# Check if Qdrant is running
curl http://localhost:6333/collections

# Restart Qdrant (Docker)
docker restart <qdrant-container-id>
```

### No search results
```bash
# Verify collection has data
curl http://localhost:6333/collections/local-search

# Re-ingest CVs
npm run ingest-cvs
```

## Performance Notes

- **CV Generation**: ~1-2 seconds per CV (with Ollama)
- **Embedding**: ~500ms per CV
- **Search**: ~100-200ms per query
- **Total for 20 CVs**: ~5-10 minutes (one-time setup)

## Key Learnings

1. **Semantic embeddings capture implicit relationships** between concepts
2. **No keyword matching needed** - the model understands "iOS developer" ≈ "mobile developer"
3. **Multilingual support** works naturally (embeddings understand multiple languages)
4. **LLM reasoning adds context** - explains WHY results match
5. **Local deployment** ensures privacy and no API costs

## Next Steps

- Add filtering by language or years of experience
- Implement hybrid search (semantic + keyword)
- Add re-ranking with cross-encoder models
- Support resume uploads via UI
- Add more advanced NLP features (named entity recognition, skill extraction)