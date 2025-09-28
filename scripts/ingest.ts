import * as dotenv from "dotenv";
import { Document, Settings, Ollama, OllamaEmbedding } from "llamaindex";
import { QdrantClient } from "@qdrant/js-client-rest";
import * as fs from "fs";

dotenv.config({ path: ".env.local" });

async function ingestDocuments() {
  try {
    console.log("🚀 Starting document ingestion...");

    // Configure Ollama for both LLM and embeddings
    Settings.llm = new Ollama({
      model: process.env.OLLAMA_MODEL || "llama3",
    });

    Settings.embedModel = new OllamaEmbedding({
      model: process.env.OLLAMA_MODEL || "llama3",
    });

    // Initialize Qdrant client with API key support
    const config: any = {
      url: process.env.QDRANT_URL || "http://localhost:6333",
    };

    // Add API key if provided (for Qdrant Cloud)
    if (process.env.QDRANT_API_KEY) {
      config.apiKey = process.env.QDRANT_API_KEY;
    }

    const client = new QdrantClient(config);

    const collectionName = process.env.QDRANT_COLLECTION || "knowledge_base";

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

    // Read the knowledge base file
    const content = fs.readFileSync("./data/knowledge_base.txt", "utf-8");

    // Split content into Q&A pairs
    const qaPairs = content.split("\n\n").filter(pair => pair.trim());

    console.log(`📄 Processing ${qaPairs.length} Q&A pairs from knowledge base`);

    // Process each Q&A pair and add to Qdrant
    const points: any[] = [];

    for (let i = 0; i < qaPairs.length; i++) {
      const text = qaPairs[i];
      console.log(`🔄 Processing pair ${i + 1}/${qaPairs.length}`);

      // Generate embedding for this text
      const embedding = await Settings.embedModel.getTextEmbedding(text);

      if (embedding && embedding.length > 0) {
        points.push({
          id: i,
          vector: embedding,
          payload: {
            text: text,
            source: "knowledge_base.txt",
            index: i,
          }
        });
      }
    }

    // Upload all points to Qdrant
    console.log("⬆️ Uploading vectors to Qdrant...");
    await client.upsert(collectionName, {
      wait: true,
      points: points,
    });

    console.log("✅ Documents successfully ingested into Qdrant!");
    console.log(`📊 Total vectors stored: ${points.length}`);
    console.log("📊 You can view your vectors at: http://localhost:6333/dashboard");

  } catch (error) {
    console.error("❌ Error during ingestion:", error);
    process.exit(1);
  }
}

// Run the ingestion
ingestDocuments();