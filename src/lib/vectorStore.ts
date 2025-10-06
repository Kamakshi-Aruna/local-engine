import { QdrantClient } from "@qdrant/js-client-rest";

export async function getVectorStore(collection?: 'local' | 'cohere') {
  // Configure client based on whether it's cloud or local
  const config: any = {
    url: process.env.QDRANT_URL || "http://localhost:6333",
  };

  // Add API key if provided (for Qdrant Cloud)
  if (process.env.QDRANT_API_KEY) {
    config.apiKey = process.env.QDRANT_API_KEY;
  }

  const client = new QdrantClient(config);

  // Select collection based on mode
  let collectionName: string;
  if (collection === 'cohere') {
    collectionName = process.env.QDRANT_COHERE_COLLECTION || "cohere-search";
  } else {
    collectionName = process.env.QDRANT_COLLECTION || "local-search";
  }

  // Return a simplified object that the API route can use
  return {
    client,
    collectionName,
    type: 'qdrant'
  };
}