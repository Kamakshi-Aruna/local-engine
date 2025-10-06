# Simple CV Search - Quick Guide

## ✨ Clean, Simple Results

The search API has been simplified to return **just names and basic info** - no lengthy analysis, just the data you need.

---

## 📡 API Response Format

### Request
```bash
curl -X POST http://localhost:3001/api/search \
  -H "Content-Type: application/json" \
  -d '{"query":"iOS Android Flutter React Native mobile app developers"}'
```

### Response
```json
{
  "success": true,
  "message": "Found 10 mobile developer(s)",
  "query": "iOS Android Flutter React Native mobile app developers",
  "results": [
    {
      "rank": 1,
      "name": "Ethan Thompson",
      "role": "Ios Developer",
      "language": "English",
      "match_score": 36,
      "file": "cv_01_ios_developer_english.txt"
    },
    {
      "rank": 2,
      "name": "Alessandro Bianchi",
      "role": "Flutter Developer",
      "language": "Italian",
      "match_score": 28,
      "file": "cv_06_flutter_developer_italian.txt"
    }
  ]
}
```

---

## 🎯 How to Use

### 1. Display Mobile Developer Names

**Query**: Include specific mobile technologies for best results

```bash
curl -X POST http://localhost:3001/api/search \
  -H "Content-Type: application/json" \
  -d '{"query":"iOS Android Flutter React Native mobile app developers"}'
```

**Output**:
- Ethan Thompson - Ios Developer (English)
- Alessandro Bianchi - Flutter Developer (Italian)
- Álvaro García López - Ios Developer (Spanish)
- Maximilian Müller - Android Developer (German)
- ...

### 2. Top N Results

**Query**: Use "top N" to limit results

```bash
curl -X POST http://localhost:3001/api/search \
  -H "Content-Type: application/json" \
  -d '{"query":"top 5 iOS developers"}'
```

**Output**: Returns top 5 matches

### 3. Specific Technology

**Query**: Search for specific skills

```bash
curl -X POST http://localhost:3001/api/search \
  -H "Content-Type: application/json" \
  -d '{"query":"Android Kotlin developers"}'
```

---

## 🚀 Quick Test

Run the test script:

```bash
chmod +x simple-test.sh
./simple-test.sh
```

**Output**:
```
🔍 Simple CV Search Test
========================

Test 1: Display mobile developer names
---------------------------------------
1. Ethan Thompson - Ios Developer (English)
2. Alessandro Bianchi - Flutter Developer (Italian)
3. Álvaro García López - Ios Developer (Spanish)
4. Maximilian Müller - Android Developer (German)
...

✅ Test complete!
```

---

## 📊 Response Fields

| Field | Description |
|-------|-------------|
| `rank` | Position in results (1, 2, 3...) |
| `name` | Developer's full name |
| `role` | Job title/role |
| `language` | CV language |
| `match_score` | Similarity score (0-100) |
| `file` | Source CV filename |

---

## 💡 Tips for Better Results

### ✅ Good Queries (Specific Technologies)
- "iOS Swift developers"
- "Android Kotlin developers"
- "Flutter Dart developers"
- "React Native JavaScript developers"
- "iOS Android Flutter React Native mobile app developers"

### ❌ Less Effective Queries (Too Generic)
- "mobile developers" (too vague)
- "app developers" (too broad)
- "developers" (matches everything)

### 🎯 Best Practice
**Include specific technologies** to get relevant mobile developers:
```
"iOS Swift Android Kotlin Flutter React Native mobile app developers"
```

This works because:
- Vector search finds CVs with these technologies
- System understands: iOS/Android/Flutter = mobile development
- Returns the right candidates even if CVs don't say "mobile"

---

## 🔍 How It Works

1. **Query → Embedding**: Your query is converted to a vector (4096 dimensions)
2. **Vector Search**: Qdrant finds CVs with similar vectors (cosine similarity)
3. **Extract Info**: Parse CV to get name, role, language
4. **Return Simple JSON**: Just the facts, no fluff

**No LLM analysis** = Faster response (~500ms vs 5s)

---

## 📝 Example Use Cases

### Use Case 1: Get All Mobile Developers
```bash
curl -X POST http://localhost:3001/api/search \
  -d '{"query":"iOS Android Flutter React Native developers"}' | \
  jq -r '.results[] | "\(.name) - \(.role)"'
```

### Use Case 2: Top 5 iOS Specialists
```bash
curl -X POST http://localhost:3001/api/search \
  -d '{"query":"top 5 iOS Swift UIKit developers"}' | \
  jq -r '.results[0:5][] | "\(.rank). \(.name)"'
```

### Use Case 3: Filter by Match Score
```bash
curl -X POST http://localhost:3001/api/search \
  -d '{"query":"Flutter developers"}' | \
  jq '.results[] | select(.match_score > 25) | "\(.name) (\(.match_score)%)"'
```

---

## 🎬 Quick Start

```bash
# 1. Ensure services are running
# Ollama: http://localhost:11434
# Qdrant: http://localhost:6333
# Next.js: http://localhost:3001

# 2. CVs already ingested (20 CVs in Qdrant)

# 3. Search for mobile developers
curl -X POST http://localhost:3001/api/search \
  -H "Content-Type: application/json" \
  -d '{"query":"iOS Android Flutter React Native mobile app developers"}'

# 4. Or use the test script
./simple-test.sh
```

---

## ✅ What Changed

### Before (Complex)
- 5-7 second response time
- Lengthy LLM analysis
- Verbose explanations
- Hard to parse results

### After (Simple)
- ~500ms response time
- Clean JSON output
- Just names and roles
- Easy to parse and display

---

## 🔧 Customization

### Change Default Limit
In `src/app/api/search/route.ts`:
```typescript
const searchLimit = topNMatch ? parseInt(topNMatch[1]) : 10; // Change 10 to your default
```

### Adjust Score Threshold
```typescript
score_threshold: 0.15, // Lower = more results, Higher = stricter
```

### Modify Response Format
Edit the `results` mapping:
```typescript
return {
  rank: index + 1,
  name: name,
  role: roleTitle,
  // Add more fields here
};
```

---

**Status**: ✅ Simplified and Working

**Response Time**: ~500ms (vs 5-7s before)

**Output**: Clean, parseable JSON with just the essentials