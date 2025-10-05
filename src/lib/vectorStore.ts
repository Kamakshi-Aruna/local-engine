import { QdrantClient } from "@qdrant/js-client-rest";

export async function getVectorStore() {
  // Configure client based on whether it's cloud or local
  const config: any = {
    url: process.env.QDRANT_URL || "http://localhost:6333",
  };

  // Add API key if provided (for Qdrant Cloud)
  if (process.env.QDRANT_API_KEY) {
    config.apiKey = process.env.QDRANT_API_KEY;
  }

  const client = new QdrantClient(config);

  const collectionName = process.env.QDRANT_COLLECTION || "pdf_documents_huggingface";
  const embeddingDimension = 384; // Hugging Face all-MiniLM-L6-v2 dimension

  // Return a simplified object that the API route can use
  return {
    client,
    collectionName,
    type: 'qdrant',
    embeddingDimension
  };
}