import { Ollama } from "llamaindex";

export interface QueryExpansion {
  originalQuery: string;
  expandedQueries: string[];
  searchContext: string;
}

export async function expandQueryWithLLM(
  query: string,
  llmModel: string = "llama3"
): Promise<QueryExpansion> {
  const ollama = new Ollama({ model: llmModel });

  const expansionPrompt = `Given the search query: "${query}"

Generate related terms, synonyms, and associated concepts that would help find relevant candidates or information.
For example:
- If searching for "mobile developer", include: iOS, Android, Swift, Kotlin, React Native, etc.
- If searching for "data scientist", include: machine learning, Python, TensorFlow, statistics, etc.

Output ONLY a comma-separated list of related terms (no explanations, no formatting):`;

  try {
    const response = await ollama.complete({
      prompt: expansionPrompt,
    });

    const expandedTerms = response.text
      .split(',')
      .map(term => term.trim())
      .filter(term => term.length > 0);

    const uniqueTerms = [...new Set([query, ...expandedTerms])];

    return {
      originalQuery: query,
      expandedQueries: uniqueTerms,
      searchContext: createSearchContext(query, uniqueTerms)
    };
  } catch (error) {
    console.error("Error expanding query with LLM:", error);
    return {
      originalQuery: query,
      expandedQueries: [query],
      searchContext: query
    };
  }
}

function createSearchContext(originalQuery: string, expandedTerms: string[]): string {
  return `${originalQuery} ${expandedTerms.join(" ")}`;
}

export async function generateMultipleEmbeddings(
  queries: string[],
  model: string = "llama3"
): Promise<number[][]> {
  const embeddings: number[][] = [];

  for (const query of queries) {
    try {
      const response = await fetch("http://localhost:11434/api/embeddings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: model,
          prompt: query,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        if (data.embedding && data.embedding.length > 0) {
          embeddings.push(data.embedding);
        }
      }
    } catch (error) {
      console.error(`Error generating embedding for "${query}":`, error);
    }
  }

  return embeddings;
}

export function combineEmbeddings(embeddings: number[][], weights?: number[]): number[] {
  if (embeddings.length === 0) return [];

  const dimension = embeddings[0].length;
  const combined = new Array(dimension).fill(0);

  const finalWeights = weights || new Array(embeddings.length).fill(1.0 / embeddings.length);

  for (let i = 0; i < embeddings.length; i++) {
    const weight = finalWeights[i];
    for (let j = 0; j < dimension; j++) {
      combined[j] += embeddings[i][j] * weight;
    }
  }

  const magnitude = Math.sqrt(combined.reduce((sum, val) => sum + val * val, 0));
  if (magnitude > 0) {
    for (let i = 0; i < dimension; i++) {
      combined[i] /= magnitude;
    }
  }

  return combined;
}

export async function semanticSearchWithExpansion(
  query: string,
  client: any,
  collectionName: string,
  llmModel: string = "llama3",
  topK: number = 5
) {
  const expansion = await expandQueryWithLLM(query, llmModel);

  const primaryEmbeddings = await generateMultipleEmbeddings(
    expansion.expandedQueries.slice(0, 3),
    llmModel
  );

  const results: any[] = [];
  const seenIds = new Set<number>();

  for (const embedding of primaryEmbeddings) {
    const searchResult = await client.search(collectionName, {
      vector: embedding,
      limit: topK,
      with_payload: true,
    });

    for (const result of searchResult) {
      if (!seenIds.has(result.id)) {
        seenIds.add(result.id);
        results.push(result);
      }
    }
  }

  results.sort((a, b) => b.score - a.score);

  return {
    results: results.slice(0, topK),
    expansion: expansion,
    totalFound: results.length
  };
}

export async function rerankResults(
  results: any[],
  query: string,
  llmModel: string = "llama3"
): Promise<any[]> {
  const ollama = new Ollama({ model: llmModel });

  const rerankedResults = [];

  for (const result of results) {
    const relevancePrompt = `Query: "${query}"
Content: "${result.payload?.text?.substring(0, 500) || ''}"

Rate the relevance of this content to the query on a scale of 0-10 (output only the number):`;

    try {
      const response = await ollama.complete({
        prompt: relevancePrompt,
      });

      const score = parseFloat(response.text.trim()) / 10;
      rerankedResults.push({
        ...result,
        rerankedScore: isNaN(score) ? result.score : score,
        originalScore: result.score
      });
    } catch (error) {
      rerankedResults.push({
        ...result,
        rerankedScore: result.score,
        originalScore: result.score
      });
    }
  }

  rerankedResults.sort((a, b) => b.rerankedScore - a.rerankedScore);

  return rerankedResults;
}