import { NextRequest, NextResponse } from "next/server";
import { SemanticSearchService } from "@/lib/semanticSearch";

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('pdf') as File;

    if (!file) {
      return NextResponse.json(
        { error: "No PDF file provided" },
        { status: 400 }
      );
    }

    if (file.type !== 'application/pdf') {
      return NextResponse.json(
        { error: "File must be a PDF" },
        { status: 400 }
      );
    }

    // Convert file to buffer
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    let textContent = '';

    try {
      // Try to use pdf-parse in a safer way
      const pdfParse = eval('require')('pdf-parse');
      const data = await pdfParse(buffer);
      textContent = data.text;
    } catch (pdfError) {
      console.log("PDF parsing failed, trying alternative method:", pdfError);

      // Fallback: treat as text or return an error
      return NextResponse.json(
        { error: "Could not extract text from PDF. Please ensure it's a text-based PDF." },
        { status: 400 }
      );
    }

    if (!textContent || textContent.trim().length === 0) {
      return NextResponse.json(
        { error: "PDF appears to be empty or unreadable" },
        { status: 400 }
      );
    }

    // Initialize our semantic search service
    const searchService = new SemanticSearchService();

    try {
      // Use our new semantic search service to add the document
      await searchService.addFullDocument(textContent, file.name);

      // Debug: Check document count after adding
      const { getDocumentCount } = await import("@/lib/vectorStore");
      const docCount = getDocumentCount();
      console.log(`✅ Successfully processed PDF: ${file.name}. Total documents: ${docCount}`);

      return NextResponse.json({
        success: true,
        message: `Successfully processed ${file.name}`,
        filename: file.name,
        textLength: textContent.length,
        chunks_created: Math.ceil(textContent.length / 1000), // Approximate chunk count
        totalDocuments: docCount
      });

    } catch (embeddingError) {
      console.error("Error processing PDF with embeddings:", embeddingError);
      return NextResponse.json(
        {
          error: "Failed to process PDF embeddings",
          details: embeddingError instanceof Error ? embeddingError.message : "Unknown error"
        },
        { status: 500 }
      );
    }

  } catch (error: any) {
    console.error("PDF upload error:", error);
    return NextResponse.json(
      {
        error: "Failed to process PDF",
        details: error.message
      },
      { status: 500 }
    );
  }
}