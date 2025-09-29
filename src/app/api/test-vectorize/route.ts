// Test endpoint to verify data in Vectorize
import { NextResponse } from "next/server";
import { getCloudflareVectorStore } from "@/lib/cloudflareVectorStore";

export async function GET() {
  try {
    const vectorStore = await getCloudflareVectorStore();

    // Test search with a generic query
    const testQueries = [
      "database",
      "SQL",
      "MongoDB",
      "constraints",
      "test"
    ];

    const results = [];

    for (const query of testQueries) {
      const result = await vectorStore.search(query, 1);
      if (result.sources && result.sources.length > 0) {
        results.push({
          query,
          found: true,
          source: result.sources[0].file,
          preview: result.sources[0].preview
        });
      } else {
        results.push({
          query,
          found: false
        });
      }
    }

    // Count how many queries found data
    const foundCount = results.filter(r => r.found).length;

    return NextResponse.json({
      message: foundCount > 0 ? "✅ DATA CONFIRMED IN VECTORIZE!" : "❌ No data found",
      total_test_queries: testQueries.length,
      successful_matches: foundCount,
      details: results,
      vectorize_status: foundCount > 0 ? "Your PDF is stored and searchable!" : "No data in Vectorize yet"
    });

  } catch (error) {
    console.error("Test error:", error);
    return NextResponse.json({
      error: "Test failed",
      details: error instanceof Error ? error.message : "Unknown error"
    }, { status: 500 });
  }
}