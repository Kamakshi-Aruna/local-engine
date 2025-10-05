import { GoogleGenerativeAI } from "@google/generative-ai";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "");

export async function generateGeminiEmbeddings(
    texts: string[]
): Promise<number[][]> {
    try {
        const model = genAI.getGenerativeModel({ model: "text-embedding-004" });
        const embeddings: number[][] = [];

        // Process texts in batches to avoid rate limits
        const batchSize = 10;
        for (let i = 0; i < texts.length; i += batchSize) {
            const batch = texts.slice(i, i + batchSize);

            for (const text of batch) {
                try {
                    const result = await model.embedContent(text);
                    const embedding = result.embedding;
                    if (embedding && embedding.values) {
                        embeddings.push(embedding.values);
                    }
                } catch (error) {
                    console.error(`Failed to generate embedding for text: ${text.substring(0, 50)}...`, error);
                    // Push zero vector as fallback
                    embeddings.push(new Array(768).fill(0));
                }
            }
        }

        return embeddings;
    } catch (error) {
        console.error("Gemini embeddings generation failed:", error);
        return [];
    }
}

export async function generateSingleEmbedding(text: string): Promise<number[]> {
    const embeddings = await generateGeminiEmbeddings([text]);
    return embeddings[0] || [];
}

export interface SearchFilters {
    source?: string;
    type?: string;
    minScore?: number;
}

export async function semanticSearchWithExpansion(
    query: string,
    client: any,
    collectionName: string,
    topK: number = 10,
    filters?: SearchFilters
) {
    const queryEmbedding = await generateSingleEmbedding(query);

    if (queryEmbedding.length === 0) {
        return { results: [], totalFound: 0 };
    }

    const searchParams: any = {
        vector: queryEmbedding,
        limit: topK,
        with_payload: true,
        score_threshold: filters?.minScore || 0.0,
    };

    if (filters?.source || filters?.type) {
        searchParams.filter = { must: [] };
        if (filters.source) {
            searchParams.filter.must.push({
                key: "source",
                match: { value: filters.source }
            });
        }
        if (filters.type) {
            searchParams.filter.must.push({
                key: "type",
                match: { value: filters.type }
            });
        }
    }

    const searchResult = await client.search(collectionName, searchParams);

    return {
        results: searchResult,
        totalFound: searchResult.length
    };
}

export async function generateAnswer(
    query: string,
    context: string,
    sourcesInfo?: Array<{fileName: string, text: string, score: number}>
): Promise<string> {
    if (!context || context.trim().length === 0) {
        return "No relevant information found in the documents.";
    }

    const queryLower = query.toLowerCase();
    const isNameQuery = queryLower.includes('name') || queryLower.includes('who') ||
                       queryLower.includes('display') || queryLower.includes('list') ||
                       queryLower.includes('show');

    if (isNameQuery && sourcesInfo) {
        return extractNamesFromSources(query, sourcesInfo);
    }

    const queryWords = query.toLowerCase().split(/\s+/);
    const contextLines = context.split('\n').filter(line => line.trim().length > 0);
    const relevantLines = contextLines.filter(line => {
        const lowerLine = line.toLowerCase();
        return queryWords.some(word => lowerLine.includes(word));
    });

    if (relevantLines.length === 0) {
        return `Based on the documents, I found some related content but no direct match for "${query}". Here's what was found:\n\n${context.substring(0, 300)}...`;
    }

    const answer = relevantLines.slice(0, 3).join('\n\n');
    return `Based on the uploaded documents, here's what I found regarding "${query}":\n\n${answer}`;
}

function extractNamesFromSources(query: string, sourcesInfo: Array<{fileName: string, text: string, score: number}>): string {
    const names = new Set<string>();

    // Use semantic similarity scores from the database
    sourcesInfo.forEach(source => {
        if (source.score > 0.4) {
            const nameWithoutExt = source.fileName.replace(/\.(pdf|doc|docx|txt)$/i, '');

            // Try multiple patterns to extract names
            let nameMatch = nameWithoutExt.match(/^([A-Z][a-z]+[\s_-]*[A-Z][a-z]+)/);

            // If no match, try single name pattern
            if (!nameMatch) {
                nameMatch = nameWithoutExt.match(/^([A-Z][a-z]+)/);
            }

            if (nameMatch) {
                let name = nameMatch[1].replace(/[\s_-]+/g, ' ').trim();

                // Handle cases like "Aruna_profile" - take just the first part if it contains underscore/dash
                const nameParts = name.split(/[\s_-]+/);
                if (nameParts.length > 1) {
                    name = nameParts[0];
                }

                if (name.length > 2) {
                    names.add(name);
                }
            }
        }
    });

    if (names.size === 0) {
        return `No relevant names found for "${query}". Found ${sourcesInfo.length} documents but none had high enough similarity scores (>0.4).`;
    }

    const namesList = Array.from(names).slice(0, 10);
    return `Names found for "${query}":\n\n${namesList.map((name, i) => `${i + 1}. ${name}`).join('\n')}\n\n(Found ${sourcesInfo.length} total documents, ${names.size} with relevant similarity)`;
}

//
export function splitIntoChunks(text: string, maxChunkSize: number): string[] {
    const chunks: string[] = [];
    const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 0);

    let currentChunk = '';
    let previousSentences: string[] = [];

    for (const sentence of sentences) {
        const trimmedSentence = sentence.trim();
        if (trimmedSentence.length === 0) continue;

        // If adding this sentence would exceed the chunk size, save current chunk
        if (currentChunk.length + trimmedSentence.length > maxChunkSize && currentChunk.length > 0) {
            chunks.push(currentChunk.trim());

            // Keep last 2-3 sentences for overlap to maintain context
            const overlapSentences = previousSentences.slice(-2);
            const overlapText = overlapSentences.join('. ');
            currentChunk = overlapText ? overlapText + '. ' + trimmedSentence : trimmedSentence;
            previousSentences = overlapText ? [...overlapSentences, trimmedSentence] : [trimmedSentence];
        } else {
            currentChunk += (currentChunk.length > 0 ? '. ' : '') + trimmedSentence;
            previousSentences.push(trimmedSentence);
        }
    }

    // Add the last chunk if it has content
    if (currentChunk.trim().length > 0) {
        chunks.push(currentChunk.trim());
    }

    return chunks;
}