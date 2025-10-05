import { VoyageAIClient } from "voyageai";

const voyage = new VoyageAIClient({
    apiKey: process.env.VOYAGE_API_KEY || "",
});

function validateVoyageApiKey(): { isValid: boolean; error?: string } {
    const apiKey = process.env.VOYAGE_API_KEY;

    if (!apiKey) {
        return { isValid: false, error: "VOYAGE_API_KEY environment variable is not set" };
    }

    if (apiKey.length < 10) {
        return { isValid: false, error: "VOYAGE_API_KEY appears to be too short" };
    }

    if (!apiKey.match(/^[a-zA-Z0-9_-]+$/)) {
        return { isValid: false, error: "VOYAGE_API_KEY contains invalid characters" };
    }

    return { isValid: true };
}

export function getVoyageApiKeyStatus() {
    return validateVoyageApiKey();
}

export interface QueryExpansion {
    originalQuery: string;
    expandedQueries: string[];
    searchContext: string;
}

export async function expandQueryWithSynonyms(
    query: string
): Promise<QueryExpansion> {
    // Simple synonym expansion for voyage (no LLM expansion like Cohere)
    const commonSynonyms: { [key: string]: string[] } = {
        "developer": ["programmer", "engineer", "coder", "software developer"],
        "engineer": ["developer", "programmer", "technical lead"],
        "manager": ["lead", "supervisor", "director", "head"],
        "experience": ["background", "expertise", "knowledge", "skills"],
        "python": ["programming", "coding", "development"],
        "javascript": ["js", "programming", "web development"],
        "react": ["frontend", "ui", "web development"],
        "node": ["nodejs", "backend", "server"],
        "database": ["db", "sql", "data", "storage"],
        "api": ["rest", "service", "endpoint", "integration"],
    };

    const words = query.toLowerCase().split(/\s+/);
    const expandedTerms = new Set([query]);

    words.forEach(word => {
        if (commonSynonyms[word]) {
            commonSynonyms[word].forEach(synonym => expandedTerms.add(synonym));
        }
    });

    const uniqueTerms = Array.from(expandedTerms);

    return {
        originalQuery: query,
        expandedQueries: uniqueTerms,
        searchContext: createSearchContext(query, uniqueTerms)
    };
}

function createSearchContext(originalQuery: string, expandedTerms: string[]): string {
    return `${originalQuery} ${expandedTerms.join(" ")}`;
}

export async function generateVoyageEmbeddings(
    texts: string[],
    model: string = "voyage-large-2"
): Promise<number[][]> {
    try {
        const response = await voyage.embed({
            input: texts,
            model: model,
        });

        return response.data?.map(item => item.embedding).filter(embedding => embedding !== undefined) as number[][] || [];
    } catch (error) {
        console.error("Voyage embedding error:", error);
        return [];
    }
}

export async function generateSingleEmbedding(
    text: string,
    model: string = "voyage-large-2"
): Promise<number[]> {
    const embeddings = await generateVoyageEmbeddings([text], model);
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

export async function semanticSearchWithExpansion(
    query: string,
    client: any,
    collectionName: string,
    topK: number = 10,
    model: string = "voyage-large-2"
) {
    const queryEmbedding = await generateSingleEmbedding(query, model);
    let results: any[] = [];
    const seenIds = new Set<number>();

    if (queryEmbedding.length > 0) {
        const searchResult = await client.search(collectionName, {
            vector: queryEmbedding,
            limit: topK * 2,
            with_payload: true,
            score_threshold: 0.0,
        });

        for (const result of searchResult) {
            if (!seenIds.has(result.id)) {
                seenIds.add(result.id);
                results.push(result);
            }
        }
    }

    const goodResults = results.filter(r => r.score > 0.3);

    if (goodResults.length < 5) {
        const expansion = await expandQueryWithSynonyms(query);
        const expandedEmbeddings = await generateVoyageEmbeddings(
            expansion.expandedQueries.slice(0, 3),
            model
        );

        for (const embedding of expandedEmbeddings) {
            if (embedding.length === 0) continue;

            const searchResult = await client.search(collectionName, {
                vector: embedding,
                limit: topK,
                with_payload: true,
                score_threshold: 0.0,
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

// Voyage doesn't have a reranking service, so we'll use a simple scoring approach
export async function rerankResults(
    results: any[],
    query: string
): Promise<any[]> {
    if (results.length === 0) return results;

    // Simple text-based relevance scoring
    const queryWords = query.toLowerCase().split(/\s+/);

    const scoredResults = results.map((result) => {
        const text = (result.payload?.text || '').toLowerCase();
        const source = (result.payload?.source || '').toLowerCase();
        const combinedText = `${text} ${source}`;

        // Count query word matches
        let matchScore = 0;
        queryWords.forEach(word => {
            const wordCount = (combinedText.match(new RegExp(word, 'g')) || []).length;
            matchScore += wordCount;
        });

        // Normalize by text length and combine with original score
        const normalizedMatchScore = matchScore / Math.max(text.length / 100, 1);
        const combinedScore = (result.score * 0.7) + (normalizedMatchScore * 0.3);

        return {
            ...result,
            rerankedScore: combinedScore,
            originalScore: result.score
        };
    });

    scoredResults.sort((a, b) => b.rerankedScore - a.rerankedScore);
    return scoredResults;
}

export async function generateAnswer(
    query: string,
    context: string
): Promise<string> {
    // Simple keyword-based answer extraction
    const lowerQuery = query.toLowerCase();
    const lowerContext = context.toLowerCase();

    // Look for names if query is about names/developers
    if (lowerQuery.includes('name') || lowerQuery.includes('developer')) {
        const namePatterns = [
            /name\s*:?\s*([A-Z][A-Z\s]+[A-Z])/gi,
            /([A-Z][a-z]+\s+[A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)/g
        ];

        const names = new Set<string>();

        for (const pattern of namePatterns) {
            const matches = context.match(pattern);
            if (matches) {
                matches.forEach(match => {
                    const cleanName = match.replace(/^(name\s*:?\s*)/i, '').trim();
                    if (cleanName.length > 3 && cleanName.length < 50) {
                        names.add(cleanName);
                    }
                });
            }
        }

        if (names.size > 0) {
            return `Java Developer Names:\n\n${Array.from(names).map(name => `• ${name}`).join('\n')}`;
        }
    }

    // For other queries, return a summary
    const sentences = context.split(/[.!?]+/).filter(s => s.trim().length > 20);
    const relevantSentences = sentences.slice(0, 3).map(s => s.trim()).join('. ');

    return `${relevantSentences}${sentences.length > 3 ? '...' : ''}`;
}