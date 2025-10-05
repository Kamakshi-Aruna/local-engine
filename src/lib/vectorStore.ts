import { vectorStore } from './embeddingService';

export { vectorStore } from './embeddingService';

export async function getVectorStore() {
  // Return our simple in-memory vector store
  // In a production environment, you would use a proper vector database
  return {
    store: vectorStore,
    type: 'simple_memory_store'
  };
}

export function getDocumentCount(): number {
  return vectorStore.getDocumentCount();
}

export function clearVectorStore(): void {
  vectorStore.clear();
}