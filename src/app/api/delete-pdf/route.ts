import { NextRequest, NextResponse } from "next/server";
import { clearVectorStore, vectorStore } from "@/lib/vectorStore";

export async function DELETE(request: NextRequest) {
  try {
    const { filename } = await request.json();

    if (!filename) {
      return NextResponse.json(
        { error: "Filename is required" },
        { status: 400 }
      );
    }

    // For our simple in-memory implementation, we'll filter documents
    const documents = vectorStore.documents;
    const initialCount = documents.length;

    if (filename === "ALL") {
      // Clear all documents
      clearVectorStore();
      return NextResponse.json({
        success: true,
        message: `Cleared all documents`,
        deletedCount: initialCount
      });
    }

    // Filter out documents from the specified file
    const filteredDocuments = documents.filter((doc: any) => doc.source !== filename);
    const deletedCount = initialCount - filteredDocuments.length;

    if (deletedCount === 0) {
      return NextResponse.json({
        success: false,
        error: "File not found in database",
        filename: filename
      });
    }

    // Replace the documents array (simple implementation)
    vectorStore.documents = filteredDocuments;

    return NextResponse.json({
      success: true,
      message: `Deleted ${deletedCount} chunks for ${filename}`,
      deletedCount: deletedCount,
      remainingChunks: filteredDocuments.length
    });

  } catch (error: any) {
    console.error("❌ Delete error:", error);
    return NextResponse.json(
      {
        error: "Failed to delete PDF",
        details: error.message
      },
      { status: 500 }
    );
  }
}