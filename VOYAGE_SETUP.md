# Voyage AI PDF Search Application

This document describes how to set up and use Voyage AI embeddings with your PDF search application.

## Overview

Your application uses **Voyage AI** for high-quality embedding models optimized for retrieval tasks.

## Environment Variables

Add these to your `.env.local` file:

```bash
# Voyage AI Configuration
VOYAGE_API_KEY=your_voyage_api_key_here
VOYAGE_MODEL=voyage-large-2

# Qdrant Configuration
QDRANT_URL=http://localhost:6333
QDRANT_API_KEY=
QDRANT_COLLECTION=pdf_documents
```

## Getting a Voyage AI API Key

1. Visit [Voyage AI](https://www.voyageai.com/)
2. Sign up for an account
3. Navigate to the API section
4. Generate an API key
5. Add it to your `.env.local` file

## Available Voyage Models

- `voyage-large-2` (1536 dimensions) - Best quality, recommended
- `voyage-code-2` (1536 dimensions) - Optimized for code
- `voyage-2` (1024 dimensions) - Balanced performance

## API Usage

### Upload PDF

```bash
curl -X POST http://localhost:3000/api/upload-pdf \
  -F "pdf=@your-document.pdf" \
  -F "model=voyage-large-2"
```

### Search Documents

```bash
curl -X POST http://localhost:3000/api/enhanced-search \
  -H "Content-Type: application/json" \
  -d '{
    "query": "your search query",
    "model": "voyage-large-2",
    "useEnhancedSearch": true,
    "rerankingEnabled": true
  }'
```

## Features

- **Embeddings**: High-quality 1536-dimensional vectors
- **Query Expansion**: Synonym-based query enhancement
- **Reranking**: Text-based relevance scoring
- **Answer Generation**: Context-based response formatting

## API Usage

```javascript
// Upload PDF
const formData = new FormData();
formData.append('pdf', file);
formData.append('model', 'voyage-large-2');

const uploadResponse = await fetch('/api/upload-pdf', {
  method: 'POST',
  body: formData
});

// Search documents
const searchResponse = await fetch('/api/enhanced-search', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    query: 'search term',
    model: 'voyage-large-2'
  })
});
```

## Best Practices

1. **Choose the right model**: Use `voyage-large-2` for general documents, `voyage-code-2` for technical documentation
2. **Monitor usage**: Track API usage and costs
3. **Optimize chunks**: Experiment with different chunk sizes for your specific documents
4. **Use enhanced search**: Enable enhanced search and reranking for better results

## Troubleshooting

### Common Issues

1. **Invalid API Key**: Ensure your `VOYAGE_API_KEY` is correctly set
2. **Model not found**: Verify the model name matches available Voyage AI models
3. **Dimension mismatch**: Different models have different embedding dimensions

### Error Messages

- `"Voyage AI API key validation failed"`: Check your API key
- `"Failed to generate embeddings with Voyage AI"`: Verify API key and model name
- `"No documents have been uploaded yet"`: Upload documents with the same provider first

## Support

For Voyage AI specific issues:
- [Voyage AI Documentation](https://docs.voyageai.com/)
- [Voyage AI Support](https://www.voyageai.com/support)

For application issues:
- Check the console logs for detailed error messages
- Ensure all environment variables are properly set