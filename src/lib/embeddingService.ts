import { GoogleGenerativeAI } from '@google/generative-ai';

// Simple in-memory vector store for demonstration
// In a real application, you'd use a proper vector database
interface VectorDocument {
  id: string;
  text: string;
  source: string;
  chunkIndex: number;
  embedding: number[];
}

class SimpleVectorStore {
  public documents: VectorDocument[] = [];

  async addDocument(doc: Omit<VectorDocument, 'id'>) {
    const id = `${doc.source}_${doc.chunkIndex}_${Date.now()}`;
    this.documents.push({ ...doc, id });
    console.log(`Added document ${id}. Total documents: ${this.documents.length}`);
  }

  async search(queryEmbedding: number[], limit: number = 5) {
    const results = this.documents
      .map(doc => ({
        ...doc,
        score: this.cosineSimilarity(queryEmbedding, doc.embedding)
      }))
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);

    return results;
  }

  private cosineSimilarity(a: number[], b: number[]): number {
    const dotProduct = a.reduce((sum, ai, i) => sum + ai * b[i], 0);
    const magnitudeA = Math.sqrt(a.reduce((sum, ai) => sum + ai * ai, 0));
    const magnitudeB = Math.sqrt(b.reduce((sum, bi) => sum + bi * bi, 0));
    return dotProduct / (magnitudeA * magnitudeB);
  }

  getDocumentCount(): number {
    return this.documents.length;
  }

  clear(): void {
    this.documents = [];
  }
}

// Global vector store instance - ensure it's truly global across modules
let globalVectorStore: SimpleVectorStore;

if (typeof global !== 'undefined') {
  // In Node.js environment, attach to global object
  if (!(global as any).__vectorStore) {
    (global as any).__vectorStore = new SimpleVectorStore();
  }
  globalVectorStore = (global as any).__vectorStore;
} else {
  // Fallback for other environments
  globalVectorStore = new SimpleVectorStore();
}

export const vectorStore = globalVectorStore;

export class EmbeddingService {
  private genAI: GoogleGenerativeAI;

  constructor() {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error('GEMINI_API_KEY environment variable is required');
    }
    this.genAI = new GoogleGenerativeAI(apiKey);
  }

  /**
   * Generate embeddings using Gemini AI
   */
  async generateEmbedding(text: string): Promise<number[]> {
    try {
      const model = this.genAI.getGenerativeModel({ model: 'text-embedding-004' });

      const result = await model.embedContent(text);
      return result.embedding.values;
    } catch (error) {
      console.error('Error generating embedding:', error);
      throw new Error('Failed to generate embedding');
    }
  }

  /**
   * Generate embeddings for multiple texts
   */
  async generateMultipleEmbeddings(texts: string[]): Promise<number[][]> {
    const embeddings: number[][] = [];

    for (const text of texts) {
      try {
        const embedding = await this.generateEmbedding(text);
        embeddings.push(embedding);
        // Small delay to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 100));
      } catch (error) {
        console.error(`Error generating embedding for text: ${text.substring(0, 50)}...`, error);
        // Continue with other texts even if one fails
      }
    }

    return embeddings;
  }

  /**
   * Expand query using Gemini AI to find related terms
   */
  async expandQuery(query: string): Promise<string[]> {
    // Temporarily disabled due to Gemini model compatibility issues
    // TODO: Fix Gemini model names and restore query expansion
    console.log('Query expansion disabled - using original query only');
    return [query];

    /* Original implementation - restore when model issues are fixed
    try {
      const model = this.genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });

      const prompt = `Given the search query: "${query}"

Generate related terms, synonyms, and associated concepts that would help find relevant information.
For example:
- If searching for "mobile developer", include: iOS, Android, Swift, Kotlin, React Native, etc.
- If searching for "data scientist", include: machine learning, Python, TensorFlow, statistics, etc.

Output ONLY a comma-separated list of related terms (no explanations, no formatting):`;

      const result = await model.generateContent(prompt);
      const response = await result.response;
      const text = response.text();

      const expandedTerms = text
        .split(',')
        .map(term => term.trim())
        .filter(term => term.length > 0 && term !== query);

      return [query, ...expandedTerms].slice(0, 5); // Limit to 5 terms
    } catch (error) {
      console.error('Error expanding query:', error);
      return [query]; // Fallback to original query
    }
    */
  }

  /**
   * Add document to vector store
   */
  async addDocument(text: string, source: string, chunkIndex: number = 0) {
    const embedding = await this.generateEmbedding(text);
    await vectorStore.addDocument({
      text,
      source,
      chunkIndex,
      embedding
    });
  }

  /**
   * Search for similar documents
   */
  async searchDocuments(query: string, limit: number = 5) {
    const queryEmbedding = await this.generateEmbedding(query);
    return await vectorStore.search(queryEmbedding, limit);
  }

  /**
   * Enhanced search with query expansion
   */
  async enhancedSearch(query: string, limit: number = 5) {
    // Expand the query
    const expandedTerms = await this.expandQuery(query);

    // Generate embeddings for all expanded terms
    const embeddings = await this.generateMultipleEmbeddings(expandedTerms);

    // Search with each embedding and collect unique results
    const allResults = new Map();

    for (let i = 0; i < embeddings.length; i++) {
      const results = await vectorStore.search(embeddings[i], limit);
      const weight = i === 0 ? 1.0 : 0.7; // Give more weight to original query

      for (const result of results) {
        if (allResults.has(result.id)) {
          // Boost score if found by multiple queries
          allResults.get(result.id).score += result.score * weight * 0.1;
        } else {
          allResults.set(result.id, {
            ...result,
            score: result.score * weight
          });
        }
      }
    }

    // Sort by score and return top results
    const finalResults = Array.from(allResults.values())
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);

    return {
      results: finalResults,
      expandedTerms,
      originalQuery: query
    };
  }
}