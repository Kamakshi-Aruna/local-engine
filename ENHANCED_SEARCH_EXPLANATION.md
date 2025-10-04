
# Enhanced Semantic Search System

## How It Works: Finding Mobile Developers Without "Mobile" Keywords

This system solves the problem of finding relevant CVs even when they don't contain exact search terms. For example, searching for "mobile developers" will find CVs mentioning iOS, Android, Swift, Kotlin, etc., without explicitly saying "mobile developer".

## Key Components

### 1. Dynamic Query Expansion with LLM
Instead of hardcoded mappings, the system uses your local LLM (Ollama) to dynamically understand term relationships:

```
User Query: "mobile developer"
     ↓
LLM Expands To: ["mobile developer", "iOS", "Android", "Swift", "Kotlin",
                 "React Native", "Flutter", "Objective-C", "Xcode",
                 "Android Studio", "mobile app", ...]
```

### 2. Multi-Embedding Search
Rather than creating one embedding, the system:
- Generates multiple embeddings for the expanded terms
- Searches with each embedding separately
- Combines and deduplicates results
- This catches documents that are semantically similar to ANY of the related concepts

### 3. Intelligent Re-ranking
After initial retrieval, the LLM re-scores each result based on relevance:
- Original vector similarity score
- LLM-based relevance scoring
- Final ranking combines both scores

## Example Workflow

**User searches:** "Show me top 5 mobile developers"

**Step 1: Query Expansion**
```javascript
// The LLM analyzes the query and generates related terms
expandedQueries = [
  "mobile developer",
  "iOS developer",
  "Android developer",
  "React Native",
  "Swift programmer",
  "Kotlin developer",
  // ... more related terms
]
```

**Step 2: Multiple Embeddings**
```javascript
// Generate embeddings for top expanded queries
embeddings = [
  embedding_for("mobile developer"),
  embedding_for("iOS developer"),
  embedding_for("Android developer")
]
```

**Step 3: Parallel Search**
```javascript
// Search with each embedding
results = []
for each embedding:
  results += vectorDB.search(embedding, limit=10)

// Deduplicate and combine
uniqueResults = removeDuplicates(results)
```

**Step 4: Re-ranking**
```javascript
// LLM evaluates each result's relevance
for each result:
  relevanceScore = LLM.evaluate(
    query: "mobile developer",
    content: result.text
  )
  result.finalScore = combineScores(vectorScore, relevanceScore)

// Sort by final score
results.sortBy(finalScore)
```

**Step 5: Context-Aware Response**
The LLM generates the final answer knowing:
- Original query
- Expanded search terms used
- All relevant documents found

## Why This Works Better

### Traditional Search (Your Original Implementation)
- Query: "mobile developer" → Embedding → Search
- Misses: CVs with "iOS Engineer", "Android Developer", etc.
- Problem: Single embedding can't capture all related concepts

### Enhanced Search (New Implementation)
- Query: "mobile developer" → Multiple related concepts → Multiple embeddings
- Finds: All CVs with related technologies
- Benefit: Captures semantic relationships dynamically

## Configuration

The system uses these environment variables:
- `OLLAMA_MODEL`: The model for embeddings and expansion (default: "llama3")
- `QDRANT_URL`: Vector database URL
- `QDRANT_COLLECTION`: Collection name for documents

## API Endpoints

### `/api/enhanced-search` (New)
- Dynamic query expansion
- Multi-embedding search
- Re-ranking capability
- Returns expansion details for transparency

### `/api/search` (Original)
- Single embedding search
- Direct vector similarity
- Faster but less comprehensive

## Performance Considerations

1. **Trade-offs:**
   - Enhanced search is more accurate but slower
   - Uses more LLM calls (expansion + re-ranking)
   - Searches multiple times in vector DB

2. **Optimization Tips:**
   - Limit expansion to top 3-5 terms
   - Cache expansion results for common queries
   - Use re-ranking only for top candidates

## Testing the System

1. **Upload diverse CVs** that don't mention "mobile" directly:
   - iOS developer CV (mentions Swift, UIKit, Xcode)
   - Android developer CV (mentions Kotlin, Android Studio)
   - React Native developer CV (mentions JavaScript, React)

2. **Search for "mobile developer"** and observe:
   - Query expansion in response
   - All three CVs should be found
   - Relevance scores for each result

3. **Compare with basic search:**
   - Set `useEnhancedSearch: false` in the API call
   - Notice fewer or no results

## Future Enhancements

1. **Query Caching**: Store expansions for common queries
2. **Feedback Loop**: Learn from user interactions to improve expansions
3. **Domain-Specific Models**: Fine-tune for technical recruiting
4. **Hybrid Search**: Combine keyword matching with semantic search
5. **Multi-language Support**: Expand queries across languages