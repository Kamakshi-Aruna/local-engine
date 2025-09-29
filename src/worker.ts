// Cloudflare Worker for AI-powered document search

export interface Env {
  VECTORIZE_INDEX: VectorizeIndex;
  AI: Ai;
}

interface DocumentChunk {
  id: string;
  text: string;
  source: string;
  chunk_index: number;
}

interface SearchRequest {
  query: string;
  limit?: number;
}

interface SearchResponse {
  success: boolean;
  answer?: string;
  query: string;
  sources?: Array<{
    file: string;
    chunk: number;
    score: number;
    preview: string;
  }>;
  error?: string;
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    // Handle CORS
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type',
        },
      });
    }

    const url = new URL(request.url);
    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
      'Content-Type': 'application/json',
    };

    try {
      if (url.pathname === '/search' && request.method === 'POST') {
        return await handleSearch(request, env, corsHeaders);
      }

      if (url.pathname === '/upload' && request.method === 'POST') {
        return await handleUpload(request, env, corsHeaders);
      }

      return new Response('Not Found', { status: 404, headers: corsHeaders });
    } catch (error) {
      console.error('Worker error:', error);
      return new Response(
        JSON.stringify({
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error'
        }),
        { status: 500, headers: corsHeaders }
      );
    }
  },
};

async function handleSearch(
  request: Request,
  env: Env,
  corsHeaders: Record<string, string>
): Promise<Response> {
  const { query, limit = 3 }: SearchRequest = await request.json();

  if (!query) {
    return new Response(
      JSON.stringify({ success: false, error: 'Query is required' }),
      { status: 400, headers: corsHeaders }
    );
  }

  try {
    // Generate embedding for the query using Cloudflare AI
    const embeddings = await env.AI.run('@cf/baai/bge-base-en-v1.5', {
      text: query,
    });

    if (!embeddings.data || embeddings.data.length === 0) {
      throw new Error('Failed to generate query embedding');
    }

    // Search in Vectorize
    const queryVector = embeddings.data[0];
    const vectorQuery = await env.VECTORIZE_INDEX.query(queryVector, {
      topK: limit,
      returnVectors: false,
      returnMetadata: true,
    });

    if (!vectorQuery.matches || vectorQuery.matches.length === 0) {
      return new Response(
        JSON.stringify({
          success: true,
          answer: "I couldn't find any relevant information for your query.",
          query: query,
          sources: [],
        } as SearchResponse),
        { headers: corsHeaders }
      );
    }

    // Extract relevant text chunks
    const sources = vectorQuery.matches.map((match) => ({
      text: match.metadata?.text as string || '',
      source: match.metadata?.source as string || 'unknown',
      chunk_index: match.metadata?.chunk_index as number || 0,
      score: match.score || 0,
    })).filter((item) => item.text.length > 0);

    const relevantTexts = sources.map((s) => s.text).join('\n\n');

    // Debug logging
    console.log('🔍 Query:', query);
    console.log('📊 Matches found:', vectorQuery.matches.length);
    console.log('📝 Sources:', sources.length);
    console.log('📄 Context length:', relevantTexts.length);
    console.log('🔤 First 200 chars of context:', relevantTexts.substring(0, 200));

    // Generate response using Cloudflare AI
    const prompt = `Based on the following context, please answer the question. Use ONLY the information provided in the context. If the answer is not in the context, say "I cannot find this information in the uploaded documents."

Context:
${relevantTexts}

Question: ${query}

Answer:`;

    const aiResponse = await env.AI.run('@cf/meta/llama-3.1-8b-instruct', {
      messages: [
        {
          role: 'system',
          content: 'You are a helpful assistant that answers questions based ONLY on the provided context. Do not use external knowledge. If the answer is not in the context, clearly state that.',
        },
        {
          role: 'user',
          content: prompt,
        },
      ],
    });

    const answer = aiResponse.response || 'I could not generate a response.';

    const response: SearchResponse = {
      success: true,
      answer: answer,
      query: query,
      sources: sources.map((s) => ({
        file: s.source,
        chunk: s.chunk_index,
        score: s.score,
        preview: s.text.substring(0, 100) + '...',
      })),
    };

    return new Response(JSON.stringify(response), { headers: corsHeaders });
  } catch (error) {
    console.error('Search error:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: 'Search failed: ' + (error instanceof Error ? error.message : 'Unknown error'),
      } as SearchResponse),
      { status: 500, headers: corsHeaders }
    );
  }
}

async function handleUpload(
  request: Request,
  env: Env,
  corsHeaders: Record<string, string>
): Promise<Response> {
  try {
    const { chunks } = await request.json();

    if (!chunks || !Array.isArray(chunks)) {
      return new Response(
        JSON.stringify({ success: false, error: 'Invalid chunks data' }),
        { status: 400, headers: corsHeaders }
      );
    }

    const vectors: VectorizeVector[] = [];

    // Process chunks in batches to avoid rate limits
    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i] as DocumentChunk;

      // Generate embedding for each chunk
      const embeddings = await env.AI.run('@cf/baai/bge-base-en-v1.5', {
        text: chunk.text,
      });

      if (embeddings.data && embeddings.data.length > 0) {
        vectors.push({
          id: chunk.id,
          values: embeddings.data[0],
          metadata: {
            text: chunk.text,
            source: chunk.source,
            chunk_index: chunk.chunk_index,
          },
        });
      }

      // Add small delay to avoid rate limiting
      if (i % 10 === 0 && i > 0) {
        await new Promise((resolve) => setTimeout(resolve, 100));
      }
    }

    // Insert vectors into Vectorize
    if (vectors.length > 0) {
      await env.VECTORIZE_INDEX.upsert(vectors);
      console.log(`✅ Uploaded ${vectors.length} vectors to Vectorize index`);
      console.log(`📄 Source: ${chunks[0].source}`);
      console.log(`🔢 Vector IDs: ${vectors.map(v => v.id).slice(0, 3).join(', ')}...`);
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: `Successfully uploaded ${vectors.length} chunks to Vectorize`,
        chunks_processed: vectors.length,
        details: {
          index: 'cloud-engine',
          source: chunks[0]?.source,
          total_chunks: vectors.length,
          sample_ids: vectors.slice(0, 3).map(v => v.id)
        }
      }),
      { headers: corsHeaders }
    );
  } catch (error) {
    console.error('Upload error:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: 'Upload failed: ' + (error instanceof Error ? error.message : 'Unknown error'),
      }),
      { status: 500, headers: corsHeaders }
    );
  }
}
