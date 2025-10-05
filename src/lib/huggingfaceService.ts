import { pipeline, env } from '@xenova/transformers';

// Disable local cache to avoid permission issues in production
env.allowLocalModels = false;
env.useBrowserCache = false;

// Cache the pipeline to avoid re-loading the model
let embedderPipeline: any = null;

async function getEmbedderPipeline() {
    if (!embedderPipeline) {
        console.log('Loading Hugging Face embedding model...');
        embedderPipeline = await pipeline(
            'feature-extraction',
            'Xenova/all-MiniLM-L6-v2',
            {
                revision: 'main',
                quantized: false
            }
        );
        console.log('Hugging Face model loaded successfully');
    }
    return embedderPipeline;
}

export interface QueryExpansion {
    originalQuery: string;
    expandedQueries: string[];
    searchContext: string;
}

export async function generateHuggingFaceEmbeddings(
    texts: string[]
): Promise<number[][]> {
    try {
        const embedder = await getEmbedderPipeline();
        const embeddings: number[][] = [];

        for (const text of texts) {
            // Generate embedding for each text
            const output = await embedder(text, { pooling: 'mean', normalize: true });

            // Convert tensor to array
            const embedding = Array.from(output.data) as number[];
            embeddings.push(embedding);
        }

        console.log(`Generated ${embeddings.length} embeddings using Hugging Face`);
        return embeddings;
    } catch (error) {
        console.error("Hugging Face embedding error:", error);
        return [];
    }
}

export async function generateSingleHuggingFaceEmbedding(
    text: string
): Promise<number[]> {
    const embeddings = await generateHuggingFaceEmbeddings([text]);
    return embeddings[0] || [];
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

export async function semanticSearchWithHuggingFace(
    query: string,
    client: any,
    collectionName: string,
    topK: number = 10
) {
    const queryEmbedding = await generateSingleHuggingFaceEmbedding(query);
    let results: any[] = [];

    if (queryEmbedding.length > 0) {
        const searchResult = await client.search(collectionName, {
            vector: queryEmbedding,
            limit: topK * 3,  // Increase limit to get more results
            with_payload: true,
        });

        // Remove duplicates and keep best results
        const seenIds = new Set<number>();
        for (const result of searchResult) {
            if (!seenIds.has(result.id)) {
                seenIds.add(result.id);
                results.push(result);
            }
        }
    }

    // Don't sort by scores - keep original order

    return {
        results: results.slice(0, topK),
        expansion: {
            originalQuery: query,
            expandedQueries: [query],
            searchContext: query
        },
        totalFound: results.length
    };
}

export function rerankHuggingFaceResults(
    results: any[],
    query: string
): any[] {
    if (results.length === 0) return results;

    // Simple keyword-based relevance scoring
    const queryWords = query.toLowerCase().split(' ').filter(word => word.length > 2);

    const rerankedResults = results.map(result => {
        const text = (result.payload?.text || '').toLowerCase();
        let relevanceScore = result.score || 0;

        // Boost score based on keyword matches
        let keywordMatches = 0;
        queryWords.forEach(word => {
            if (text.includes(word)) {
                keywordMatches++;
            }
        });

        // Add keyword match bonus
        if (queryWords.length > 0) {
            const keywordBonus = (keywordMatches / queryWords.length) * 0.2;
            relevanceScore = Math.min(1.0, relevanceScore + keywordBonus);
        }

        return {
            ...result,
            rerankedScore: relevanceScore,
            originalScore: result.score || 0
        };
    });

    // Don't sort by reranked scores - keep original order
    return rerankedResults;
}

// Simple answer generation - filter out contact patterns
export async function generateAnswerWithHuggingFace(
    query: string,
    context: string
): Promise<string> {
    if (!context || context.trim().length === 0) {
        return "No relevant information found for your query.";
    }

    const lines = context.split('\n').map(line => line.trim()).filter(line => line.length > 0);
    const cleanedLines = [];

    for (const line of lines) {
        // Skip lines that look like contact information (contain @ symbols, phone patterns, or are very short)
        if (line.includes('@') ||
            line.match(/\+\d/) ||
            line.match(/mobile|phone|linkedin|github/i) ||
            line.includes('—') ||
            line.match(/\d{6}/) ||
            (line.length < 15 && line.match(/\d{4}/))) {
            continue;
        }

        cleanedLines.push(line);
    }

    return cleanedLines.join('\n') || context.trim();
}