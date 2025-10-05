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

// Alternative: Use Hugging Face API for embeddings
async function generateHuggingFaceAPIEmbedding(text: string): Promise<number[]> {
    const apiKey = process.env.HUGGINGFACE_API_KEY;

    if (!apiKey) {
        console.log('No HF API key found, falling back to local model');
        return generateSingleHuggingFaceEmbedding(text);
    }

    try {
        console.log('Using Hugging Face API for embedding generation');
        const response = await fetch(
            'https://api-inference.huggingface.co/pipeline/feature-extraction/sentence-transformers/all-MiniLM-L6-v2',
            {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${apiKey}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    inputs: text,
                    options: { wait_for_model: true }
                }),
            }
        );

        if (!response.ok) {
            throw new Error(`HF API error: ${response.status}`);
        }

        const embedding = await response.json();
        console.log(`Generated API embedding of dimension: ${embedding.length}`);
        return embedding;
    } catch (error) {
        console.error('HF API embedding failed, falling back to local:', error);
        return generateSingleHuggingFaceEmbedding(text);
    }
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
    console.log(`🔍 Searching for query: "${query}" in collection: ${collectionName}`);

    // Try API first, fallback to local model
    const queryEmbedding = process.env.HUGGINGFACE_API_KEY
        ? await generateHuggingFaceAPIEmbedding(query)
        : await generateSingleHuggingFaceEmbedding(query);

    let results: any[] = [];

    if (queryEmbedding.length > 0) {
        console.log(`✅ Generated embedding of dimension: ${queryEmbedding.length}`);

        const searchResult = await client.search(collectionName, {
            vector: queryEmbedding,
            limit: topK * 3,  // Increase limit to get more results
            with_payload: true,
            with_vectors: false,
        });

        console.log(`📊 Found ${searchResult.length} initial results`);

        // Filter out results with very low similarity scores (irrelevant results)
        const relevantResults = searchResult.filter(result => result.score > 0.2);
        console.log(`📊 After relevance filtering (>0.2): ${relevantResults.length} results`);

        // Remove duplicates and keep best results
        const seenIds = new Set<number>();
        for (const result of relevantResults) {
            if (!seenIds.has(result.id)) {
                seenIds.add(result.id);
                results.push(result);
            }
        }

        console.log(`📊 After deduplication: ${results.length} results`);
    }

    // Sort by similarity scores (higher is better)
    results.sort((a, b) => (b.score || 0) - (a.score || 0));

    console.log(`🎯 Top 3 results by score:`);
    results.slice(0, 3).forEach((r, i) => {
        console.log(`  ${i + 1}. Score: ${r.score?.toFixed(4)}, Text preview: ${r.payload?.text?.substring(0, 50)}...`);
    });

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
        let exactMatches = 0;

        queryWords.forEach(word => {
            if (text.includes(word)) {
                keywordMatches++;
                // Check for exact word match (surrounded by word boundaries)
                const exactWordRegex = new RegExp(`\\b${word}\\b`, 'i');
                if (exactWordRegex.test(text)) {
                    exactMatches++;
                }
            }
        });

        // Add keyword match bonus with higher weight for exact matches
        if (queryWords.length > 0) {
            const keywordBonus = (keywordMatches / queryWords.length) * 0.2;
            const exactBonus = (exactMatches / queryWords.length) * 0.3;
            relevanceScore = Math.min(1.0, relevanceScore + keywordBonus + exactBonus);
        }

        return {
            ...result,
            rerankedScore: relevanceScore,
            originalScore: result.score || 0
        };
    });

    // Sort by reranked scores (higher is better)
    rerankedResults.sort((a, b) => (b.rerankedScore || 0) - (a.rerankedScore || 0));

    return rerankedResults;
}

export async function generateAnswerWithHuggingFace(
    query: string,
    context: string
): Promise<string> {
    if (!context) {
        return "No information found.";
    }

    // Split content into sections by ---
    const sections = context.split('---');
    const names = [];

    // Get first line from each section (usually the name)
    for (const section of sections) {
        const firstLine = section.split('\n')[0]?.trim();

        // Check if it looks like a person name (not too long, has space)
        if (firstLine &&
            firstLine.length < 30 &&
            firstLine.includes(' ') &&
            !firstLine.includes('@') &&
            /^[A-Z]/.test(firstLine)) {
            names.push(firstLine);
        }
    }

    return names.length > 0
        ? names.map(name => `• ${name}`).join('\n')
        : "No names found.";
}