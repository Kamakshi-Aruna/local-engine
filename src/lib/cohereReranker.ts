import { CohereClientV2 } from 'cohere-ai';

interface SearchResult {
  id: string;
  text: string;
  source: string;
  chunkIndex: number;
  score: number;
}

interface RerankResult extends SearchResult {
  originalScore: number;
  rerankScore: number;
}

export class CohereReranker {
  private cohere: CohereClientV2;

  constructor() {
    const apiKey = process.env.COHERE_API_KEY;
    if (!apiKey) {
      throw new Error('COHERE_API_KEY environment variable is required');
    }
    this.cohere = new CohereClientV2({
      token: apiKey,
    });
  }

  /**
   * Rerank search results using Cohere's rerank-v3 model
   */
  async rerankResults(
    query: string,
    results: SearchResult[],
    topK: number = 5
  ): Promise<RerankResult[]> {
    try {
      if (results.length === 0) {
        return [];
      }

      // Prepare documents for reranking
      const documents = results.map(result => result.text);

      // Call Cohere rerank API
      const rerankResponse = await this.cohere.rerank({
        model: 'rerank-v3.5',
        query: query,
        documents: documents,
        topN: Math.min(topK, results.length),
        returnDocuments: false, // We already have the documents
      });

      // Map reranked results back to original format
      const rerankedResults: RerankResult[] = rerankResponse.results.map(result => {
        const originalResult = results[result.index];
        return {
          ...originalResult,
          originalScore: originalResult.score,
          rerankScore: result.relevanceScore,
          score: result.relevanceScore // Update main score
        };
      });

      return rerankedResults;
    } catch (error) {
      console.error('Error reranking results with Cohere:', error);

      // Fallback: return original results if reranking fails
      return results.slice(0, topK).map(result => ({
        ...result,
        originalScore: result.score,
        rerankScore: result.score
      }));
    }
  }

  /**
   * Simple relevance scoring using Cohere (alternative to rerank)
   */
  async scoreRelevance(query: string, document: string): Promise<number> {
    try {
      // Use a simple approach with the chat model for scoring
      const prompt = `Rate the relevance of the following document to the query on a scale of 0.0 to 1.0.

Query: "${query}"

Document: "${document.substring(0, 500)}"

Output only a number between 0.0 and 1.0:`;

      const response = await this.cohere.chat({
        model: 'command-r',
        message: prompt,
        maxTokens: 10,
      });

      const scoreText = response.message.content[0]?.text?.trim() || '0';
      const score = parseFloat(scoreText);

      return isNaN(score) ? 0 : Math.max(0, Math.min(1, score));
    } catch (error) {
      console.error('Error scoring relevance:', error);
      return 0;
    }
  }
}