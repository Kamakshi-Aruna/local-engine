import { NextRequest, NextResponse } from "next/server";
import { getVectorStore } from "@/lib/vectorStore";
import {
  semanticSearchWithExpansion,
  rerankResults,
  generateSingleEmbedding,
  generateAnswer,
  getVoyageApiKeyStatus
} from "@/lib/voyageService";

export async function POST(request: NextRequest) {
  try {
    const { query, useEnhancedSearch = true, rerankingEnabled = true, model = "voyage-large-2" } = await request.json();

    if (!query) {
      return NextResponse.json(
        { error: "Query is required" },
        { status: 400 }
      );
    }

    // Validate Voyage AI API key
    const keyStatus = getVoyageApiKeyStatus();
    if (!keyStatus.isValid) {
      return NextResponse.json(
        {
          error: "Voyage AI API key validation failed",
          details: keyStatus.error,
          suggestion: "Please check your VOYAGE_API_KEY environment variable."
        },
        { status: 500 }
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
      try {
        const enhancedResults = await semanticSearchWithExpansion(
          query,
          client,
          collectionName,
          10,
          model
        );

        searchResults = enhancedResults.results;
        queryExpansion = enhancedResults.expansion;

        if (rerankingEnabled && searchResults && searchResults.length > 0) {
          searchResults = await rerankResults(searchResults, query);
        }
      } catch (searchError) {
        console.error("❌ Enhanced search failed:", searchError);
        throw new Error(`Enhanced search failed: ${searchError instanceof Error ? searchError.message : 'Unknown error'}`);
      }
    } else {
      try {
        const queryEmbedding = await generateSingleEmbedding(query, model);

        if (!queryEmbedding || queryEmbedding.length === 0) {
          throw new Error("Failed to generate query embedding");
        }

        searchResults = await client.search(collectionName, {
          vector: queryEmbedding,
          limit: 5,
          with_payload: true,
        });
      } catch (searchError) {
        console.error("❌ Basic search failed:", searchError);
        throw new Error(`Basic search failed: ${searchError instanceof Error ? searchError.message : 'Unknown error'}`);
      }
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

    // Generate answer using Voyage AI
    let answer;
    try {
      answer = await generateAnswer(query, relevantTexts);
    } catch (answerError) {
      console.error("❌ Answer generation failed:", answerError);
      throw new Error(`Answer generation failed: ${answerError instanceof Error ? answerError.message : 'Unknown error'}`);
    }

    return NextResponse.json({
      success: true,
      answer: answer,
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
      rerankingApplied: useEnhancedSearch && rerankingEnabled,
      aiProvider: "Voyage AI",
      model: model
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