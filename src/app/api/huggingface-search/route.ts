import { NextRequest, NextResponse } from "next/server";
import { getVectorStore } from "@/lib/vectorStore";
import {
  semanticSearchWithHuggingFace,
  rerankHuggingFaceResults,
  generateSingleHuggingFaceEmbedding,
  generateAnswerWithHuggingFace
} from "@/lib/huggingfaceService";

export async function POST(request: NextRequest) {
  try {
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
      try {
        const enhancedResults = await semanticSearchWithHuggingFace(
          query,
          client,
          collectionName,
          20
        );

        searchResults = enhancedResults.results;
        queryExpansion = enhancedResults.expansion;

        if (rerankingEnabled && searchResults.length > 0) {
          searchResults = rerankHuggingFaceResults(searchResults, query);
        }
      } catch (searchError) {
        console.error("❌ Hugging Face enhanced search failed:", searchError);
        throw new Error(`Hugging Face enhanced search failed: ${searchError instanceof Error ? searchError.message : 'Unknown error'}`);
      }
    } else {
      try {
        const queryEmbedding = await generateSingleHuggingFaceEmbedding(query);

        if (queryEmbedding.length === 0) {
          throw new Error("Failed to generate query embedding with Hugging Face");
        }

        searchResults = await client.search(collectionName, {
          vector: queryEmbedding,
          limit: 5,
          with_payload: true,
        });
      } catch (searchError) {
        console.error("❌ Hugging Face basic search failed:", searchError);
        throw new Error(`Hugging Face basic search failed: ${searchError instanceof Error ? searchError.message : 'Unknown error'}`);
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

    // Get unique files from results
    const uniqueFiles = [...new Set(sources.map(s => s.source))];

    // For each unique file, get ALL chunks to find the name and relevant content
    const developersWithNames = [];
    for (const fileName of uniqueFiles) {
      try {
        // Get ALL chunks from this file
        const allChunks = await client.scroll(collectionName, {
          filter: {
            must: [
              {
                key: "source",
                match: {
                  value: fileName
                }
              }
            ]
          },
          limit: 100,
          with_payload: true,
        });

        // Find the chunk with the name (usually chunk 0 or the first chunk with name pattern)
        let nameText = "";
        let relevantContent = [];

        for (const point of allChunks.points || []) {
          const text = point.payload?.text || "";
          const chunkIndex = point.payload?.chunk_index || 0;

          // Check if this chunk contains a name (usually in chunk 0)
          if (chunkIndex === 0 || text.match(/^[A-Z][a-z]+ [A-Z][a-z]+/)) {
            if (!nameText && chunkIndex === 0) {
              nameText = text;
            }
          }

          // Add relevant content from matching chunks
          const matchingSource = sources.find(s => s.source === fileName && s.chunk_index === chunkIndex);
          if (matchingSource) {
            relevantContent.push(text);
          }
        }

        // Combine name with relevant content
        if (nameText || relevantContent.length > 0) {
          const combinedText = nameText ?
            `${nameText}\n---\n${relevantContent.join('\n')}` :
            relevantContent.join('\n');
          developersWithNames.push(combinedText);
        }
      } catch (error) {
        console.error(`Error fetching chunks for ${fileName}:`, error);
      }
    }

    const relevantTexts = developersWithNames.join("\n\n---\n\n");

    // Generate answer using Hugging Face-based approach
    let answer;
    try {
      answer = await generateAnswerWithHuggingFace(query, relevantTexts);
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
      aiProvider: "Hugging Face",
      model: "all-MiniLM-L6-v2"
    });

  } catch (error) {
    console.error("Hugging Face search error:", error);
    return NextResponse.json(
      {
        error: "Search failed",
        details: error instanceof Error ? error.message : "Unknown error"
      },
      { status: 500 }
    );
  }
}