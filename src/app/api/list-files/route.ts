import { NextResponse } from "next/server";
import { getDocumentCount, vectorStore } from "@/lib/vectorStore";

export async function GET() {
  try {
    const documentCount = getDocumentCount();

    if (documentCount === 0) {
      return NextResponse.json({
        success: true,
        files: [],
        count: 0
      });
    }

    // Since we're using a simple in-memory store, we need to access it directly
    // In a real vector database, you'd query for unique sources
    const uniqueFiles = new Set<string>();

    // Access the documents array from our simple vector store
    const documents = vectorStore.documents;

    documents.forEach((doc: any) => {
      if (doc.source) {
        uniqueFiles.add(doc.source);
      }
    });

    const files = Array.from(uniqueFiles).sort();

    return NextResponse.json({
      success: true,
      files: files,
      count: files.length,
      totalChunks: documentCount
    });

  } catch (error: any) {
    console.error("❌ List files error:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Failed to list files",
        details: error.message
      },
      { status: 500 }
    );
  }
}