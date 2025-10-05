import { EmbeddingService } from './embeddingService';
import { CohereReranker } from './cohereReranker';

export interface SearchResult {
  id: string;
  text: string;
  source: string;
  chunkIndex: number;
  score: number;
  originalScore?: number;
  rerankScore?: number;
}

export interface EnhancedSearchResult {
  results: SearchResult[];
  expandedTerms: string[];
  originalQuery: string;
  totalFound: number;
  searchMethod: 'basic' | 'enhanced' | 'reranked';
}

export class SemanticSearchService {
  private embeddingService: EmbeddingService;
  private reranker: CohereReranker;

  constructor() {
    this.embeddingService = new EmbeddingService();
    this.reranker = new CohereReranker();
  }

  /**
   * Basic semantic search using embeddings
   */
  async basicSearch(query: string, limit: number = 5): Promise<EnhancedSearchResult> {
    try {
      const results = await this.embeddingService.searchDocuments(query, limit);

      return {
        results,
        expandedTerms: [query],
        originalQuery: query,
        totalFound: results.length,
        searchMethod: 'basic'
      };
    } catch (error) {
      console.error('Error in basic search:', error);
      return {
        results: [],
        expandedTerms: [query],
        originalQuery: query,
        totalFound: 0,
        searchMethod: 'basic'
      };
    }
  }

  /**
   * Enhanced search with query expansion
   */
  async enhancedSearch(query: string, limit: number = 5): Promise<EnhancedSearchResult> {
    try {
      const searchResult = await this.embeddingService.enhancedSearch(query, limit);

      return {
        results: searchResult.results,
        expandedTerms: searchResult.expandedTerms,
        originalQuery: query,
        totalFound: searchResult.results.length,
        searchMethod: 'enhanced'
      };
    } catch (error) {
      console.error('Error in enhanced search:', error);
      // Fallback to basic search
      return await this.basicSearch(query, limit);
    }
  }

  /**
   * Full search with enhancement and reranking
   */
  async searchWithReranking(
    query: string,
    limit: number = 5,
    useEnhancement: boolean = true
  ): Promise<EnhancedSearchResult> {
    try {
      // First, get search results
      const searchResult = useEnhancement
        ? await this.enhancedSearch(query, limit * 2) // Get more results for reranking
        : await this.basicSearch(query, limit * 2);

      // If no results, return early
      if (searchResult.results.length === 0) {
        return searchResult;
      }

      // Rerank the results
      const rerankedResults = await this.reranker.rerankResults(
        query,
        searchResult.results,
        limit
      );

      return {
        results: rerankedResults,
        expandedTerms: searchResult.expandedTerms,
        originalQuery: query,
        totalFound: rerankedResults.length,
        searchMethod: 'reranked'
      };
    } catch (error) {
      console.error('Error in search with reranking:', error);
      // Fallback to enhanced search without reranking
      return await this.enhancedSearch(query, limit);
    }
  }

  /**
   * Add document to the search index
   */
  async addDocument(text: string, source: string, chunkIndex: number = 0): Promise<void> {
    try {
      await this.embeddingService.addDocument(text, source, chunkIndex);
    } catch (error) {
      console.error('Error adding document:', error);
      throw error;
    }
  }

  /**
   * Process and chunk a large text document
   */
  chunkText(text: string, chunkSize: number = 1000, overlap: number = 200): string[] {
    const chunks: string[] = [];
    let start = 0;

    while (start < text.length) {
      const end = Math.min(start + chunkSize, text.length);
      const chunk = text.slice(start, end);

      // Try to break at sentence boundaries
      if (end < text.length) {
        const lastSentenceEnd = chunk.lastIndexOf('.');
        if (lastSentenceEnd > chunk.length * 0.5) {
          chunks.push(chunk.slice(0, lastSentenceEnd + 1));
          start = start + lastSentenceEnd + 1 - overlap;
        } else {
          chunks.push(chunk);
          start = end - overlap;
        }
      } else {
        chunks.push(chunk);
        break;
      }
    }

    return chunks.filter(chunk => chunk.trim().length > 50); // Filter out very short chunks
  }

  /**
   * Add a full document by chunking it first
   */
  async addFullDocument(text: string, source: string): Promise<void> {
    const chunks = this.chunkText(text);
    console.log(`Processing ${source}: ${chunks.length} chunks created from ${text.length} characters`);

    for (let i = 0; i < chunks.length; i++) {
      console.log(`Processing chunk ${i + 1}/${chunks.length} for ${source}`);
      await this.addDocument(chunks[i], source, i);
      // Small delay to avoid overwhelming the API
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    console.log(`Finished processing ${source}. Total chunks processed: ${chunks.length}`);
  }
}