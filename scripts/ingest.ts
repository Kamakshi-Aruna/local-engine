import * as dotenv from "dotenv";
import { Settings, Ollama, OllamaEmbedding } from "llamaindex";
import { QdrantClient } from "@qdrant/js-client-rest";
import * as fs from "fs";
import * as path from "path";

dotenv.config({ path: ".env.local" });

async function ingestPDFs() {
  try {
    console.log("🚀 Starting PDF ingestion...");

    // Configure Ollama for both LLM and embeddings
    Settings.llm = new Ollama({
      model: process.env.OLLAMA_MODEL || "llama3",
    });

    Settings.embedModel = new OllamaEmbedding({
      model: process.env.OLLAMA_MODEL || "llama3",
    });

    // Initialize Qdrant client (local only)
    const client = new QdrantClient({
      url: process.env.QDRANT_URL || "http://localhost:6333",
    });

    const collectionName = process.env.QDRANT_COLLECTION || "pdf_documents";

    // Check if collection exists, if yes delete it (for fresh start)
    try {
      await client.deleteCollection(collectionName);
      console.log("🗑️ Deleted existing collection");
    } catch (error) {
      console.log("📝 No existing collection found");
    }

    // Create new collection
    await client.createCollection(collectionName, {
      vectors: {
        size: 4096, // Ollama embedding dimension
        distance: "Cosine",
      },
    });
    console.log("✅ Created new collection:", collectionName);

    // Look for PDF files in data directory
    const dataDir = "./data";
    const pdfFiles = fs.readdirSync(dataDir).filter(file => file.endsWith('.pdf'));

    if (pdfFiles.length === 0) {
      console.log("❌ No PDF files found in data directory");
      console.log("📁 Please add PDF files to the ./data directory");
      return;
    }

    console.log(`📄 Found ${pdfFiles.length} PDF files to process`);

    // Process each PDF file using the upload API
    for (let i = 0; i < pdfFiles.length; i++) {
      const pdfFile = pdfFiles[i];
      const filePath = path.join(dataDir, pdfFile);

      console.log(`🔄 Processing PDF ${i + 1}/${pdfFiles.length}: ${pdfFile}`);

      try {
        // Read PDF file
        const pdfBuffer = fs.readFileSync(filePath);

        // Use the same PDF processing logic from upload-pdf route
        await processPDFFile(pdfBuffer, pdfFile, client, collectionName);

        console.log(`✅ Successfully processed: ${pdfFile}`);
      } catch (error) {
        console.error(`❌ Error processing ${pdfFile}:`, error);
      }
    }

    console.log("✅ All PDFs successfully ingested into Qdrant!");
    console.log("📊 You can view your vectors at: http://localhost:6333/dashboard");

  } catch (error) {
    console.error("❌ Error during ingestion:", error);
    process.exit(1);
  }
}

async function processPDFFile(buffer: Buffer, fileName: string, client: QdrantClient, collectionName: string) {
  let textContent = '';

  try {
    // Use pdf-parse to extract text
    const pdfParse = require('pdf-parse');
    const data = await pdfParse(buffer);
    textContent = data.text;
  } catch (pdfError) {
    throw new Error(`Failed to parse PDF: ${pdfError}`);
  }

  if (!textContent || textContent.trim().length === 0) {
    throw new Error("PDF appears to be empty or unreadable");
  }

  // Split text into chunks (roughly 500 characters each)
  const chunks = splitIntoChunks(textContent, 500);

  // Generate random starting ID to avoid conflicts
  const startId = 1000 + Math.floor(Math.random() * 10000);
  const points: any[] = [];

  for (let i = 0; i < chunks.length; i++) {
    const chunk = chunks[i];

    // Generate embedding for this chunk using Ollama
    const embedding = await Settings.embedModel.getTextEmbedding(chunk);

    if (embedding && embedding.length > 0) {
      const point = {
        id: startId + i,
        vector: embedding,
        payload: {
          text: chunk,
          source: fileName,
          type: "pdf",
          chunk_index: i,
          total_chunks: chunks.length,
        }
      };

      points.push(point);
    }
  }

  // Upload all points to Qdrant
  if (points.length > 0) {
    await client.upsert(collectionName, {
      wait: true,
      points: points,
    });
  }

  console.log(`   📊 Created ${points.length} chunks for ${fileName}`);
}

// Helper function to split text into chunks
function splitIntoChunks(text: string, maxChunkSize: number): string[] {
  const chunks: string[] = [];
  const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 0);

  let currentChunk = '';

  for (const sentence of sentences) {
    const trimmedSentence = sentence.trim();
    if (trimmedSentence.length === 0) continue;

    // If adding this sentence would exceed the chunk size, save current chunk
    if (currentChunk.length + trimmedSentence.length > maxChunkSize && currentChunk.length > 0) {
      chunks.push(currentChunk.trim());
      currentChunk = trimmedSentence;
    } else {
      currentChunk += (currentChunk.length > 0 ? '. ' : '') + trimmedSentence;
    }
  }

  // Add the last chunk if it has content
  if (currentChunk.trim().length > 0) {
    chunks.push(currentChunk.trim());
  }

  return chunks;
}

// Run the ingestion
ingestPDFs();