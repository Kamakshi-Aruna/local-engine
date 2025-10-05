# Gemini AI Setup Guide

This project now uses Google's Gemini AI for relevant search functionality.

## Prerequisites

1. **Google AI Studio Account**
   - Go to [Google AI Studio](https://aistudio.google.com/)
   - Sign in with your Google account

2. **Generate API Key**
   - In Google AI Studio, click "Get API key"
   - Create a new API key
   - Copy the generated key

## Environment Setup

1. **Add API Key to Environment**
   ```bash
   # Add to your .env.local file
   GEMINI_API_KEY=your_api_key_here
   ```

2. **Install Dependencies**
   ```bash
   npm install
   ```

## Features

### Document Processing
- **Text Extraction**: Extracts text from PDF files
- **Smart Chunking**: Splits documents into overlapping chunks for better context
- **Embeddings**: Uses Gemini's text-embedding-004 model for vector representations

### Search Capabilities
- **Semantic Search**: Vector-based similarity search using Gemini embeddings
- **Query Expansion**: Automatically expands queries with related terms
- **Answer Generation**: Uses Gemini 1.5 Flash for comprehensive answers
- **Filtering**: Support for source, type, and score-based filtering

### Vector Database
- **Qdrant Integration**: Stores and searches document embeddings
- **Cosine Similarity**: Optimized for semantic similarity matching
- **Scalable Storage**: Handles large document collections efficiently

## API Endpoints

### Upload PDF
```bash
POST /api/upload-pdf
Content-Type: multipart/form-data

# Form data:
pdf: [PDF file]
```

### Search Documents
```bash
POST /api/enhanced-search
Content-Type: application/json

{
  "query": "your search query",
  "useEnhancedSearch": true,
  "filters": {
    "source": "filename.pdf",
    "type": "pdf",
    "minScore": 0.3
  }
}
```

## Response Format

```json
{
  "success": true,
  "answer": "Generated answer based on documents",
  "query": "original query",
  "queryExpansion": {
    "originalQuery": "query",
    "expandedQueries": ["query", "related", "terms"],
    "searchContext": "combined context"
  },
  "sources": [
    {
      "file": "document.pdf",
      "chunk": 0,
      "score": 0.85,
      "preview": "Text preview..."
    }
  ],
  "searchMethod": "enhanced",
  "aiProvider": "Gemini"
}
```

## Testing

Run the test script to verify everything works:

```bash
node test-gemini-search.js
```

## Troubleshooting

### Common Issues

1. **API Key Issues**
   - Ensure GEMINI_API_KEY is set in .env.local
   - Verify the API key is valid and active
   - Check Google AI Studio for usage limits

2. **Embedding Dimension Mismatch**
   - Gemini text-embedding-004 produces 768-dimension vectors
   - Ensure Qdrant collection is configured for 768 dimensions

3. **Rate Limiting**
   - Gemini has rate limits on API calls
   - The service includes automatic batching and error handling

### Performance Tips

1. **Chunk Size**: Adjust chunk size based on your document types
2. **Overlap**: Use overlap between chunks for better context preservation
3. **Filtering**: Use filters to narrow search scope and improve performance
4. **Caching**: Consider implementing caching for frequently accessed embeddings

## Models Used

- **Embeddings**: text-embedding-004 (768 dimensions)
- **Text Generation**: gemini-1.5-flash
- **Query Expansion**: gemini-1.5-flash

## Cost Considerations

- Gemini pricing is based on API usage
- Embeddings cost per token processed
- Text generation costs per token generated
- Monitor usage in Google AI Studio console