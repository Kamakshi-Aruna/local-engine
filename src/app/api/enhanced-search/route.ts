import { NextRequest, NextResponse } from "next/server";
import { Settings, Ollama, OllamaEmbedding } from "llamaindex";
import { getVectorStore } from "@/lib/vectorStore";
import {
  expandQueryWithLLM,
  semanticSearchWithExpansion,
  rerankResults
} from "@/lib/semanticSearch";

export async function POST(request: NextRequest) {
  try {
    const ollamaModel = process.env.OLLAMA_MODEL || "llama3";

    Settings.llm = new Ollama({
      model: ollamaModel,
    });

    Settings.embedModel = new OllamaEmbedding({
      model: ollamaModel,
    });

    const { query, useEnhancedSearch = true, rerankingEnabled = true } = await request.json();

    if (!query) {
      return NextResponse.json(
        { error: "Query is required" },
        { status: 400 }
      );
    }

    const { client, collectionName } = await getVectorStore();

    try {
      await client.getCollection(collectionName);
    } catch (error) {
      return NextResponse.json({
        success: true,
        answer: "No documents have been uploaded yet. Please upload some PDF documents first.",
        query: query,
      });
    }

    let searchResults;
    let queryExpansion = null;

    if (useEnhancedSearch) {
      const enhancedResults = await semanticSearchWithExpansion(
        query,
        client,
        collectionName,
        ollamaModel,
        10
      );

      searchResults = enhancedResults.results;
      queryExpansion = enhancedResults.expansion;

      if (rerankingEnabled && searchResults.length > 0) {
        searchResults = await rerankResults(searchResults, query, ollamaModel);
      }
    } else {
      const embeddingResponse = await fetch("http://localhost:11434/api/embeddings", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: ollamaModel,
          prompt: query,
        }),
      });

      if (!embeddingResponse.ok) {
        throw new Error(`Failed to generate embedding: ${embeddingResponse.status}`);
      }

      const embeddingData = await embeddingResponse.json();
      const queryEmbedding = embeddingData.embedding;

      searchResults = await client.search(collectionName, {
        vector: queryEmbedding,
        limit: 5,
        with_payload: true,
      });
    }

    if (!searchResults || searchResults.length === 0) {
      return NextResponse.json({
        success: true,
        answer: "I couldn't find any relevant information for your query.",
        query: query,
        queryExpansion: queryExpansion,
      });
    }

    const sources = searchResults.map((result: any) => ({
      text: result.payload?.text || "",
      source: result.payload?.source || "unknown",
      chunk_index: result.payload?.chunk_index || 0,
      score: result.rerankedScore || result.score || 0,
      originalScore: result.originalScore || result.score || 0
    })).filter((item: any) => item.text.length > 0);

    const relevantTexts = sources.slice(0, 5).map(s => s.text).join("\n\n---\n\n");

    const systemPrompt = queryExpansion
      ? `You are a helpful assistant analyzing CVs and documents. The user is searching for: "${query}"

Related concepts that were considered in the search: ${queryExpansion.expandedQueries.join(", ")}

Answer based on the provided context. If someone has experience with related technologies (e.g., iOS/Android for mobile, React/Angular for frontend), consider them relevant even if they don't use the exact terms from the query.`
      : `You are a helpful assistant that answers questions based on the provided context.`;

    const prompt = `Context from documents:
${relevantTexts}

Question: ${query}

Please provide a comprehensive answer based on the context above. If listing candidates or items, be sure to include all relevant matches and explain why they match the criteria.`;

    const llm = Settings.llm;
    const response = await llm.chat({
      messages: [
        {
          role: "system",
          content: systemPrompt
        },
        {
          role: "user",
          content: prompt
        }
      ]
    });

    return NextResponse.json({
      success: true,
      answer: response.message.content,
      query: query,
      queryExpansion: queryExpansion,
      sources: sources.map(s => ({
        file: s.source,
        chunk: s.chunk_index,
        score: s.score,
        originalScore: s.originalScore,
        preview: s.text.substring(0, 150) + "..."
      })),
      searchMethod: useEnhancedSearch ? "enhanced" : "basic",
      rerankingApplied: useEnhancedSearch && rerankingEnabled
    });

  } catch (error) {
    console.error("Enhanced search error:", error);
    return NextResponse.json(
      {
        error: "Search failed",
        details: error instanceof Error ? error.message : "Unknown error"
      },
      { status: 500 }
    );
  }
}