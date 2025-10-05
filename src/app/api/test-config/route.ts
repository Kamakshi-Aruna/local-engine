import { NextResponse } from "next/server";
import { getDocumentCount } from "@/lib/vectorStore";

export async function GET() {
  try {
    // Check if API keys are configured
    const geminiKey = process.env.GEMINI_API_KEY;
    const cohereKey = process.env.COHERE_API_KEY;

    // Get current document count
    const documentCount = getDocumentCount();

    return NextResponse.json({
      success: true,
      config: {
        geminiApiKeySet: !!geminiKey,
        cohereApiKeySet: !!cohereKey,
        geminiKeyPrefix: geminiKey?.substring(0, 8) + "...",
        cohereKeyPrefix: cohereKey?.substring(0, 8) + "..."
      },
      vectorStore: {
        documentCount,
        status: documentCount > 0 ? "has_documents" : "empty"
      }
    });

  } catch (error: any) {
    console.error("Config test error:", error);
    return NextResponse.json(
      {
        error: "Failed to check configuration",
        details: error.message
      },
      { status: 500 }
    );
  }
}