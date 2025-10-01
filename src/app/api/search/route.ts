// Cloudflare-powered search API route with Tool Calling integration
import { NextRequest, NextResponse } from "next/server";
import { getCloudflareVectorStore } from "@/lib/cloudflareVectorStore";

export async function POST(request: NextRequest) {
  try {
    const { query } = await request.json();

    if (!query) {
      return NextResponse.json(
        { error: "Query is required" },
        { status: 400 }
      );
    }

    // Get Cloudflare vector store
    const vectorStore = await getCloudflareVectorStore();

    // Search using Cloudflare Worker (now includes tool calling)
    const result = await vectorStore.search(query, 3);

    if (!result.success) {
      return NextResponse.json(
        {
          error: "Search failed",
          details: result.error || "Unknown error"
        },
        { status: 500 }
      );
    }

    // If the worker detected tool calls but didn't execute them (for some reason),
    // we can execute them here as a fallback
    if (result.tool_calls && result.tool_calls.length > 0 && (!result.tool_results || result.tool_results.length === 0)) {
      try {
        // Call our local tools API as fallback
        const toolResponse = await fetch(`${request.nextUrl.origin}/api/tools`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ tools: result.tool_calls }),
        });

        if (toolResponse.ok) {
          const toolData = await toolResponse.json();
          if (toolData.success && toolData.results) {
            // Update the result with tool results
            result.tool_results = toolData.results;

            // Note: We would need to re-generate the answer with tool results
            // For now, we'll just include the tool results in the response
          }
        }
      } catch (toolError) {
        console.warn("Tool calling fallback failed:", toolError);
        // Continue without tool results
      }
    }

    return NextResponse.json(result);

  } catch (error) {
    console.error("❌ Cloudflare search error:", error);
    return NextResponse.json(
      {
        error: "Search failed",
        details: error instanceof Error ? error.message : "Unknown error"
      },
      { status: 500 }
    );
  }
}