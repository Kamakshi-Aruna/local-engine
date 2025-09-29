// Cloudflare-powered search API route
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

    // Search using Cloudflare Worker
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