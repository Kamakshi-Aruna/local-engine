// Cloudflare Worker for AI-powered document search

// Type definitions for Cloudflare Workers
declare global {
  interface VectorizeVector {
    id: string;
    values: number[];
    metadata?: Record<string, any>;
  }

  interface VectorizeQueryResult {
    matches: Array<{
      id: string;
      score: number;
      metadata?: Record<string, any>;
    }>;
  }

  interface VectorizeIndex {
    query(vector: number[], options?: { topK?: number; returnVectors?: boolean; returnMetadata?: boolean }): Promise<VectorizeQueryResult>;
    upsert(vectors: VectorizeVector[]): Promise<void>;
  }

  interface Ai {
    run(model: string, input: any): Promise<any>;
  }
}

export interface Env {
  VECTORIZE_INDEX: VectorizeIndex;
  AI: Ai;
  OPENWEATHER_API_KEY: string;
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
  tool_calls?: Array<{
    id: string;
    function: {
      name: string;
      arguments: string;
    };
  }>;
  tool_results?: Array<{
    tool_call_id: string;
    result: any;
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
    // The BGE model already understands semantic similarity
    // e.g., "mobile developer" will match documents with "iOS", "Android" etc.
    console.log('🔍 Query:', query);

    const embeddings = await env.AI.run('@cf/baai/bge-base-en-v1.5', {
      text: query,
    });

    if (!embeddings.data || embeddings.data.length === 0) {
      throw new Error('Failed to generate query embedding');
    }

    // Search in Vectorize
    const queryVector = embeddings.data[0];
    // Check if query requires tool calling for real-time data (do this early)
    const toolCalls = detectToolCalls(query);
    let toolResults: any[] = [];

    // Execute tool calls if detected
    if (toolCalls.length > 0) {
      toolResults = await executeToolCalls(toolCalls, env);
    }

    // Increase topK for better recall, then we'll re-rank
    const searchLimit = Math.max(limit * 3, 10);
    const vectorQuery = await env.VECTORIZE_INDEX.query(queryVector, {
      topK: searchLimit,
      returnVectors: false,
      returnMetadata: true,
    });

    // Handle case where no documents found
    if (!vectorQuery.matches || vectorQuery.matches.length === 0) {
      if (toolResults.length > 0) {
        // Generate AI response using only tool results
        const systemPrompt = `You are a helpful assistant that provides real-time information using tools. Answer the user's question using only the tool results provided.`;

        const toolResultsText = toolResults.map(tr =>
          `Tool: ${tr.tool_call_id}\nResult: ${JSON.stringify(tr.result, null, 2)}`
        ).join('\n\n');

        const prompt = `Question: ${query}\n\nReal-time data from tools:\n${toolResultsText}\n\nAnswer:`;

        const aiResponse = await env.AI.run('@cf/meta/llama-3.1-8b-instruct', {
          messages: [
            {
              role: 'system',
              content: systemPrompt,
            },
            {
              role: 'user',
              content: prompt,
            },
          ],
        });

        const answer = aiResponse.response || 'I could not generate a response.';

        return new Response(
          JSON.stringify({
            success: true,
            answer: answer,
            query: query,
            sources: [],
            tool_calls: toolCalls,
            tool_results: toolResults,
          } as SearchResponse),
          { headers: corsHeaders }
        );
      }

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

    // Extract and enhance relevant text chunks with score details
    const sources = vectorQuery.matches.map((match) => ({
      text: match.metadata?.text as string || '',
      source: match.metadata?.source as string || 'unknown',
      chunk_index: match.metadata?.chunk_index as number || 0,
      score: match.score || 0,
    })).filter((item) => item.text.length > 0);

    // Sort by score and take top results
    sources.sort((a, b) => b.score - a.score);
    const topSources = sources.slice(0, limit);

    const relevantTexts = topSources.map((s) => s.text).join('\n\n');

    // Enhanced debug logging with similarity scores
    console.log('🔍 Query:', query);
    console.log('📊 Matches found:', vectorQuery.matches.length);
    console.log('🎯 Top scores:', topSources.map(s => `${s.source}: ${s.score.toFixed(3)}`).join(', '));
    console.log('📝 Sources returned:', topSources.length);
    console.log('📄 Context length:', relevantTexts.length);
    console.log('🔤 First 200 chars of context:', relevantTexts.substring(0, 200));

    // Generate response using Cloudflare AI with tool call support
    const systemPrompt = `You are a helpful assistant. Answer questions based ONLY on the provided context from uploaded documents.

Important:
- If information is not in the context, simply say you don't have that information
- Do NOT suggest using other tools, APIs, or external data sources
- Do NOT mention GitHub, Stack Overflow, or any other external services
- Only answer based on what's in the provided documents`;

    let prompt = `Context from documents:
${relevantTexts}

Question: ${query}`;

    if (toolResults.length > 0) {
      const toolResultsText = toolResults.map(tr =>
        `Tool: ${tr.tool_call_id}\nResult: ${JSON.stringify(tr.result, null, 2)}`
      ).join('\n\n');
      prompt += `\n\nReal-time data from tools:
${toolResultsText}`;
    }

    prompt += '\n\nAnswer:';

    const aiResponse = await env.AI.run('@cf/meta/llama-3.1-8b-instruct', {
      messages: [
        {
          role: 'system',
          content: systemPrompt,
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
      tool_calls: toolCalls.length > 0 ? toolCalls : undefined,
      tool_results: toolResults.length > 0 ? toolResults : undefined,
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

function detectToolCalls(query: string): Array<{
  id: string;
  function: {
    name: string;
    arguments: string;
  };
}> {
  const toolCalls = [];
  const lowercaseQuery = query.toLowerCase();


  // Detect weather requests
  if (lowercaseQuery.includes('weather') || lowercaseQuery.includes('weater') ||
      lowercaseQuery.includes('temperature') || lowercaseQuery.includes('forecast')) {

    // Simple approach: remove common weather-related words and extract the city
    let city = query
      .replace(/current/gi, '')
      .replace(/weather/gi, '')
      .replace(/weater/gi, '')
      .replace(/temperature/gi, '')
      .replace(/forecast/gi, '')
      .replace(/in/gi, '')
      .replace(/for/gi, '')
      .replace(/at/gi, '')
      .replace(/the/gi, '')
      .trim();

    // If no city found, default to New York
    if (!city) {
      city = 'New York';
    }

    toolCalls.push({
      id: `weather_${Date.now()}`,
      function: {
        name: 'fetch_weather',
        arguments: JSON.stringify({ city })
      }
    });
  }


  return toolCalls;
}

async function executeToolCalls(toolCalls: Array<{
  id: string;
  function: {
    name: string;
    arguments: string;
  };
}>, env: Env): Promise<Array<{
  tool_call_id: string;
  result: any;
}>> {
  const results = [];

  for (const toolCall of toolCalls) {
    try {
      const args = JSON.parse(toolCall.function.arguments);
      let result;

      switch (toolCall.function.name) {
        case 'fetch_weather':
          result = await handleWeatherFetch(args, env);
          break;
        default:
          result = { error: `Unknown tool: ${toolCall.function.name}` };
      }

      results.push({
        tool_call_id: toolCall.id,
        result: result
      });
    } catch (error) {
      results.push({
        tool_call_id: toolCall.id,
        result: { error: `Tool execution failed: ${error instanceof Error ? error.message : 'Unknown error'}` }
      });
    }
  }

  return results;
}

async function handleWeatherFetch(args: { city?: string }, env: Env) {
  try {
    const apiKey = env.OPENWEATHER_API_KEY;

    if (!apiKey) {
      return { error: "OpenWeather API key not configured. Real weather data unavailable." };
    }

    const city = args.city || 'New York';
    const url = `https://api.openweathermap.org/data/2.5/weather?q=${encodeURIComponent(city)}&appid=${apiKey}&units=metric`;

    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Weather API error: ${response.status}`);
    }

    const data = await response.json();

    const weatherData = {
      location: data.name + (data.sys?.country ? `, ${data.sys.country}` : ''),
      temperature: Math.round(data.main.temp),
      condition: data.weather[0]?.description || 'unknown',
      humidity: data.main.humidity,
      wind_speed: Math.round(data.wind?.speed * 3.6), // Convert m/s to km/h
      timestamp: new Date().toISOString(),
      sunrise: new Date(data.sys.sunrise * 1000).toISOString(),
      sunset: new Date(data.sys.sunset * 1000).toISOString(),
      pressure: data.main.pressure,
      visibility: data.visibility ? Math.round(data.visibility / 1000) : null
    };

    return {
      weather: weatherData,
      source: "openweather_api"
    };
  } catch (error) {
    return { error: `Weather fetch failed: ${error instanceof Error ? error.message : 'Unknown error'}` };
  }
}

