import { QdrantClient } from "@qdrant/js-client-rest";
import { CohereClient } from "cohere-ai";
import * as dotenv from "dotenv";
import * as fs from "fs";
import * as path from "path";
import * as pdfParse from "pdf-parse";

// Load environment variables
dotenv.config({ path: ".env.local" });

const cohere = new CohereClient({
  token: process.env.COHERE_API_KEY || "",
});

const qdrantClient = new QdrantClient({
  url: process.env.QDRANT_URL || "http://localhost:6333",
  apiKey: process.env.QDRANT_API_KEY,
});

// Helper function to split text into chunks
function splitIntoChunks(text: string, maxChunkSize: number = 500): string[] {
  const chunks: string[] = [];
  const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 0);

  let currentChunk = '';

  for (const sentence of sentences) {
    const trimmedSentence = sentence.trim();
    if (trimmedSentence.length === 0) continue;

    if (currentChunk.length + trimmedSentence.length > maxChunkSize && currentChunk.length > 0) {
      chunks.push(currentChunk.trim());
      currentChunk = trimmedSentence;
    } else {
      currentChunk += (currentChunk.length > 0 ? '. ' : '') + trimmedSentence;
    }
  }

  if (currentChunk.trim().length > 0) {
    chunks.push(currentChunk.trim());
  }

  return chunks;
}

async function generateCohereEmbeddings(
  texts: string[],
  inputType: "search_document" | "search_query" = "search_document"
): Promise<number[][]> {
  try {
    const response = await cohere.embed({
      texts: texts,
      model: "embed-english-v3.0",
      inputType: inputType,
      truncate: "END"
    });

    return response.embeddings as number[][];
  } catch (error) {
    console.error("Error generating Cohere embeddings:", error);
    return [];
  }
}

async function reindexDocuments() {
  console.log("🚀 Starting re-indexing process with Cohere embeddings...\n");

  // Check if Cohere API key is set
  if (!process.env.COHERE_API_KEY || process.env.COHERE_API_KEY === 'your-cohere-api-key-here') {
    console.error("❌ Error: Please set your COHERE_API_KEY in .env.local");
    console.log("Get your API key from: https://dashboard.cohere.com/api-keys");
    process.exit(1);
  }

  const oldCollectionName = process.env.QDRANT_COLLECTION || "pdf_documents";
  const newCollectionName = "pdf_documents_cohere";

  try {
    // Step 1: Check if old collection exists and has data
    let oldDocuments: any[] = [];
    try {
      const oldCollection = await qdrantClient.getCollection(oldCollectionName);
      console.log(`📊 Found old collection '${oldCollectionName}' with ${oldCollection.points_count} points`);

      // Retrieve all documents from old collection
      const scrollResult = await qdrantClient.scroll(oldCollectionName, {
        limit: 1000,
        with_payload: true,
        with_vector: false
      });

      oldDocuments = scrollResult.points;
      console.log(`📄 Retrieved ${oldDocuments.length} documents from old collection\n`);
    } catch (error) {
      console.log(`ℹ️  Old collection '${oldCollectionName}' not found or empty\n`);
    }

    // Step 2: Create or recreate the new collection
    try {
      await qdrantClient.deleteCollection(newCollectionName);
      console.log(`🗑️  Deleted existing collection '${newCollectionName}'`);
    } catch (error) {
      // Collection doesn't exist, that's fine
    }

    await qdrantClient.createCollection(newCollectionName, {
      vectors: {
        size: 1024, // Cohere embed-english-v3.0 dimension
        distance: "Cosine",
      },
    });
    console.log(`✅ Created new collection '${newCollectionName}' with 1024 dimensions\n`);

    // Step 3: Group documents by source file
    const documentsBySource = new Map<string, any[]>();
    for (const doc of oldDocuments) {
      const source = doc.payload?.source || 'unknown';
      if (!documentsBySource.has(source)) {
        documentsBySource.set(source, []);
      }
      documentsBySource.get(source)!.push(doc);
    }

    // Step 4: Re-index documents with Cohere embeddings
    let totalIndexed = 0;
    for (const [source, docs] of documentsBySource) {
      console.log(`📝 Processing: ${source}`);

      // Extract text from all chunks of this source
      const texts = docs
        .sort((a, b) => (a.payload?.chunk_index || 0) - (b.payload?.chunk_index || 0))
        .map(doc => doc.payload?.text || '')
        .filter(text => text.length > 0);

      if (texts.length === 0) {
        console.log(`  ⚠️  No text content found, skipping...`);
        continue;
      }

      // Generate Cohere embeddings for all chunks
      console.log(`  🔄 Generating embeddings for ${texts.length} chunks...`);
      const embeddings = await generateCohereEmbeddings(texts, "search_document");

      if (embeddings.length === 0) {
        console.log(`  ❌ Failed to generate embeddings, skipping...`);
        continue;
      }

      // Prepare points for insertion
      const points: any[] = [];
      let startId = 1000 + Math.floor(Math.random() * 10000);

      for (let i = 0; i < Math.min(texts.length, embeddings.length); i++) {
        const originalDoc = docs[i];
        points.push({
          id: startId + i,
          vector: embeddings[i],
          payload: {
            text: texts[i],
            source: source,
            type: originalDoc.payload?.type || "pdf",
            chunk_index: i,
            total_chunks: texts.length,
            original_id: originalDoc.id
          }
        });
      }

      // Insert into new collection
      await qdrantClient.upsert(newCollectionName, {
        wait: true,
        points: points,
      });

      console.log(`  ✅ Indexed ${points.length} chunks\n`);
      totalIndexed += points.length;
    }

    // Step 5: Check for PDF files in data/sample-cvs directory
    const pdfDir = path.join(process.cwd(), 'data', 'sample-cvs');
    if (fs.existsSync(pdfDir)) {
      const pdfFiles = fs.readdirSync(pdfDir).filter(file => file.endsWith('.pdf'));

      if (pdfFiles.length > 0) {
        console.log(`📁 Found ${pdfFiles.length} PDF files in data/sample-cvs/\n`);

        for (const pdfFile of pdfFiles) {
          const filePath = path.join(pdfDir, pdfFile);
          console.log(`📝 Processing: ${pdfFile}`);

          try {
            const dataBuffer = fs.readFileSync(filePath);
            const data = await pdfParse(dataBuffer);
            const textContent = data.text;

            if (!textContent || textContent.trim().length === 0) {
              console.log(`  ⚠️  PDF appears to be empty, skipping...`);
              continue;
            }

            // Split into chunks
            const chunks = splitIntoChunks(textContent, 500);
            console.log(`  📄 Split into ${chunks.length} chunks`);

            // Generate embeddings
            console.log(`  🔄 Generating Cohere embeddings...`);
            const embeddings = await generateCohereEmbeddings(chunks, "search_document");

            if (embeddings.length === 0) {
              console.log(`  ❌ Failed to generate embeddings, skipping...`);
              continue;
            }

            // Prepare points
            const points: any[] = [];
            const startId = 2000 + Math.floor(Math.random() * 10000);

            for (let i = 0; i < Math.min(chunks.length, embeddings.length); i++) {
              points.push({
                id: startId + i,
                vector: embeddings[i],
                payload: {
                  text: chunks[i],
                  source: pdfFile,
                  type: "pdf",
                  chunk_index: i,
                  total_chunks: chunks.length,
                }
              });
            }

            // Insert into collection
            await qdrantClient.upsert(newCollectionName, {
              wait: true,
              points: points,
            });

            console.log(`  ✅ Indexed ${points.length} chunks\n`);
            totalIndexed += points.length;

          } catch (error) {
            console.log(`  ❌ Error processing PDF: ${error}\n`);
          }
        }
      }
    }

    // Step 6: Summary
    console.log("=" .repeat(50));
    console.log("✅ Re-indexing complete!");
    console.log(`📊 Total chunks indexed: ${totalIndexed}`);
    console.log(`🗄️  New collection: ${newCollectionName}`);
    console.log(`📏 Embedding dimensions: 1024 (Cohere)`);
    console.log("\n🎯 Next steps:");
    console.log("1. Your documents are now indexed with Cohere embeddings");
    console.log("2. Start your app with: npm run dev");
    console.log("3. Search should now work correctly with Cohere!");

  } catch (error) {
    console.error("❌ Error during re-indexing:", error);
    process.exit(1);
  }
}

// Run the re-indexing
reindexDocuments().catch(console.error);