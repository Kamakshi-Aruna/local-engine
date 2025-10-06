# 🎬 Semantic CV Search - Live Demo

## Quick Start

### 1. Prerequisites Check
```bash
# Check Ollama
curl http://localhost:11434/api/tags

# Check Qdrant
curl http://localhost:6333/collections/local-search

# Check Next.js
curl http://localhost:3001/api/search
```

### 2. Run the Demo
```bash
# Make test script executable
chmod +x test-search.sh

# Run tests
./test-search.sh
```

---

## 🔍 Live Search Examples

### Example 1: Finding Mobile Developers (Indirect Match)

**Query**: "Show me top 5 mobile developers"

**What happens**:
1. Query is embedded into a vector
2. Qdrant searches for similar CV vectors
3. Returns iOS, Android, Flutter developers
4. LLM explains why they match

**Expected CVs**:
- ✅ iOS Developer (Swift, Objective-C, UIKit)
- ✅ Android Developer (Kotlin, Java, Android SDK)
- ✅ Flutter Developer (Flutter, Dart)
- ✅ React Native Developer (React Native, JS)

**Why it works**: Even though CVs never say "mobile developer", the embeddings understand:
- Swift + iOS = Mobile development
- Kotlin + Android = Mobile development
- Flutter = Mobile development

---

### Example 2: Direct Technology Match

**Query**: "Find iOS specialists"

**Expected Result**:
- iOS developers ranked #1 and #2
- Higher similarity scores (~0.4-0.5)
- Other mobile devs might appear with lower scores

---

### Example 3: Skill-Based Search

**Query**: "Backend developers with API experience"

**Expected CVs**:
- Backend developers with REST API, GraphQL
- Full-stack developers (also work with APIs)

---

### Example 4: Cross-Language Search

**Query**: "mobile app developers" (English)

**Can find**:
- English CVs: "iOS Developer"
- Spanish CVs: "Desarrollador iOS"
- French CVs: "Développeur Android"
- German CVs: "Flutter Entwickler"

**Why**: Embeddings capture meaning across languages!

---

## 📊 Understanding the Results

### Response Format
```json
{
  "success": true,
  "query": "Show me top 5 mobile developers",
  "answer": "LLM-generated analysis explaining why candidates match...",
  "candidates": [
    {
      "rank": 1,
      "file": "cv_01_ios_developer_english.txt",
      "profile_type": "ios_developer",
      "language": "english",
      "score": 0.236,
      "preview": "First 200 chars of CV..."
    }
  ]
}
```

### Score Interpretation
- **0.3 - 1.0**: Excellent match (direct hit)
- **0.2 - 0.3**: Good match (related concepts)
- **0.15 - 0.2**: Moderate match (some relevance)
- **< 0.15**: Filtered out (not relevant)

---

## 🧪 Testing Different Scenarios

### Test 1: Generic Query
```bash
curl -X POST http://localhost:3001/api/search \
  -H "Content-Type: application/json" \
  -d '{"query":"Show me top 5 mobile developers"}'
```

**Expected**: Mixed mobile developers (iOS, Android, Flutter, React Native)

### Test 2: Specific Technology
```bash
curl -X POST http://localhost:3001/api/search \
  -H "Content-Type: application/json" \
  -d '{"query":"Swift iOS developers"}'
```

**Expected**: iOS developers with high scores

### Test 3: Skill Combination
```bash
curl -X POST http://localhost:3001/api/search \
  -H "Content-Type: application/json" \
  -d '{"query":"developers experienced in building scalable applications"}'
```

**Expected**: Backend, Full-stack, DevOps engineers

### Test 4: Cross-Language
```bash
curl -X POST http://localhost:3001/api/search \
  -H "Content-Type: application/json" \
  -d '{"query":"desarrolladores móviles"}'  # Spanish: mobile developers
```

**Expected**: Mobile developers (works across languages!)

---

## 🎯 Key Demonstrations

### 1. Semantic Understanding
**Proof**: Search "mobile developers" → Get iOS/Android devs
- No keyword "mobile" in CVs
- Embeddings understand iOS/Android = mobile

### 2. Indirect Information Matching
**Proof**: Query mentions "developer" → CVs say "engineer" or "specialist"
- Still matches due to semantic similarity
- LLM explains the equivalence

### 3. Multi-Language Support
**Proof**: English query → Spanish/French CVs match
- Embeddings capture cross-lingual meaning
- "iOS developer" ≈ "Desarrollador iOS"

### 4. Skill Inference
**Proof**: Search "app builders" → Get mobile developers
- LLM understands: mobile devs build apps
- Implicit relationship captured

---

## 📈 Comparing with Keyword Search

### Keyword Search (SQL LIKE)
```sql
SELECT * FROM cvs
WHERE skills LIKE '%mobile%' OR title LIKE '%mobile%'
```
**Result**: ❌ 0 matches (no CV contains "mobile")

### Semantic Search (Vector Embeddings)
```typescript
// Embed query
const queryVector = embeddings("mobile developers")

// Find similar
const results = qdrant.search(queryVector, limit: 5)
```
**Result**: ✅ 5 matches (iOS, Android, Flutter, React Native, hybrid)

---

## 🔧 Adjusting Search Behavior

### Increase Results
```typescript
// In search/route.ts
const searchLimit = 10  // Default: 5
```

### Adjust Threshold
```typescript
// More strict (higher precision)
score_threshold: 0.25

// More lenient (higher recall)
score_threshold: 0.10
```

### Change Model
```bash
# Use different Ollama model
ollama pull mistral

# Update .env.local
OLLAMA_MODEL=mistral
```

---

## 📝 Sample CVs Overview

### Mobile CVs (8)
```
cv_01_ios_developer_english.txt      → Swift, Objective-C, UIKit
cv_02_ios_developer_spanish.txt      → Swift, iOS SDK
cv_03_android_developer_french.txt   → Kotlin, Java, Android
cv_04_android_developer_german.txt   → Android SDK, Jetpack
cv_05_flutter_developer_english.txt  → Flutter, Dart
cv_06_flutter_developer_italian.txt  → Flutter, cross-platform
cv_07_react_native_developer_spanish.txt → React Native, JS
cv_08_react_native_developer_french.txt  → React Native, Expo
```

### Non-Mobile CVs (12)
```
cv_09-11: Backend (Node.js, Python, PostgreSQL)
cv_12-14: Frontend (React, Vue, TypeScript)
cv_15-17: Full Stack (React, Node, APIs)
cv_18-20: DevOps (Kubernetes, Docker, AWS)
```

---

## 🎓 What This Demonstrates

1. **Vector Embeddings > Keywords**
   - Captures meaning, not just words
   - Handles synonyms, related concepts
   - Works across languages

2. **Semantic Search Is Powerful**
   - Finds "mobile devs" without keyword "mobile"
   - Understands iOS/Android/Flutter = mobile
   - Implicit relationships work

3. **LLM Adds Context**
   - Explains why results match
   - Provides intelligent ranking
   - User-friendly explanations

4. **Local Infrastructure Works**
   - No API costs
   - Complete privacy
   - Acceptable performance

---

## 🚀 Next Steps

### Try These Queries
- "Find React experts"
- "Show me DevOps engineers"
- "Developers with cloud experience"
- "Frontend specialists"
- "API development experts"

### Experiment With
- Different threshold values
- Multilingual queries
- Skill combinations
- Vague vs specific queries

### Extend The System
- Add filters (years of experience, location)
- Implement hybrid search (vector + keyword)
- Build a UI dashboard
- Add more CVs
- Fine-tune embeddings

---

## 📞 Quick Commands

```bash
# Generate CVs
npm run generate-cvs

# Ingest to Qdrant
npm run ingest-cvs

# Start server
npm run dev

# Test searches
./test-search.sh

# Check Qdrant
curl http://localhost:6333/collections/local-search

# Manual search
curl -X POST http://localhost:3001/api/search \
  -H "Content-Type: application/json" \
  -d '{"query":"YOUR_QUERY_HERE"}'
```

---

## ✅ Success Checklist

- [x] Ollama running (llama3 model)
- [x] Qdrant running (local-search collection)
- [x] 20 CVs generated
- [x] CVs ingested (embeddings created)
- [x] Next.js server running
- [x] Search API working
- [x] Semantic matching verified

---

**Ready to demo!** 🎉

Run `./test-search.sh` to see semantic search in action!