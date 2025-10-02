import { NextRequest, NextResponse } from "next/server";
import { Settings, Ollama, OllamaEmbedding } from "llamaindex";
import { getVectorStore } from "@/lib/vectorStore";

export async function POST(request: NextRequest) {
  try {
    // Initialize Ollama settings
    Settings.llm = new Ollama({
      model: process.env.OLLAMA_MODEL || "llama3",
    });

    Settings.embedModel = new OllamaEmbedding({
      model: process.env.OLLAMA_MODEL || "llama3",
    });

    const { query } = await request.json();

    if (!query) {
      return NextResponse.json(
        { error: "Query is required" },
        { status: 400 }
      );
    }

    // Get vector store config
    const { client, collectionName } = await getVectorStore();

    // Check if collection exists
    try {
      await client.getCollection(collectionName);
    } catch (error) {
      return NextResponse.json({
        success: true,
        answer: "No documents have been uploaded yet. Please upload some PDF documents first.",
        query: query,
      });
    }

    // Generate embedding for the query
    const embeddingResponse = await fetch("http://localhost:11434/api/embeddings", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: process.env.OLLAMA_MODEL || "llama3",
        prompt: query,
      }),
    });

    if (!embeddingResponse.ok) {
      throw new Error(`Failed to generate embedding: ${embeddingResponse.status}`);
    }

    const embeddingData = await embeddingResponse.json();
    const queryEmbedding = embeddingData.embedding;

    if (!queryEmbedding || queryEmbedding.length === 0) {
      throw new Error("Generated embedding is null or empty");
    }

    // Search in Qdrant
    const searchResult = await client.search(collectionName, {
      vector: queryEmbedding as number[],
      limit: 3,
      with_payload: true,
    });

    if (!searchResult || searchResult.length === 0) {
      return NextResponse.json({
        success: true,
        answer: "I couldn't find any relevant information for your query.",
        query: query,
      });
    }

    // Extract text and metadata from search results
    const sources = searchResult.map((result: any) => ({
      text: result.payload?.text || "",
      // Handle both CV structure (metadata.filename) and PDF structure (source)
      source: result.payload?.source || result.payload?.metadata?.filename || "unknown",
      chunk_index: result.payload?.chunk_index || 0,
      score: result.score || 0
    })).filter((item: any) => item.text.length > 0);

    const relevantTexts = sources.map(s => s.text).join("\n\n");

    // Generate response using Ollama
    const prompt = `Based on the following context, please answer the question. Use ONLY the information provided in the context. If the answer is not in the context, say "I cannot find this information in the uploaded documents."

Context:
${relevantTexts}

Question: ${query}

Answer:`;

    const llm = Settings.llm;
    const response = await llm.chat({
      messages: [
        {
          role: "system",
          content: "You are a helpful assistant that answers questions based ONLY on the provided context. Do not use external knowledge. If the answer is not in the context, clearly state that."
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
      sources: sources.map(s => ({
        file: s.source,
        chunk: s.chunk_index,
        score: s.score,
        preview: s.text.substring(0, 100) + "..."
      }))
    });

  } catch (error) {
    console.error("❌ Search error:", error);
    return NextResponse.json(
      {
        error: "Search failed",
        details: error instanceof Error ? error.message : "Unknown error"
      },
      { status: 500 }
    );
  }
}