import * as dotenv from "dotenv";
import { QdrantClient } from "@qdrant/js-client-rest";

dotenv.config({ path: ".env.local" });

async function checkPDFStorage() {
  console.log("🔍 Checking PDF storage in Qdrant...\n");

  const config: any = {
    url: process.env.QDRANT_URL || "http://localhost:6333",
  };

  if (process.env.QDRANT_API_KEY) {
    config.apiKey = process.env.QDRANT_API_KEY;
  }

  const client = new QdrantClient(config);
  const collectionName = process.env.QDRANT_COLLECTION || "knowledge_base";

  try {
    // Get collection info
    const collectionInfo = await client.getCollection(collectionName);
    console.log("📊 Collection Statistics:");
    console.log(`Total points: ${collectionInfo.points_count}`);
    console.log(`Vector size: ${collectionInfo.config.params.vectors.size}`);
    console.log("");

    // Try to scroll through points to see what's stored
    console.log("📄 First 10 points (Q&A):");
    const scrollResult = await client.scroll(collectionName, {
      limit: 10,
      with_payload: true,
    });

    if (scrollResult.points && scrollResult.points.length > 0) {
      scrollResult.points.forEach((point: any, index: number) => {
        console.log(`${index + 1}. ID: ${point.id} | Source: ${point.payload?.source || 'Unknown'} | Type: ${point.payload?.type || 'Q&A'}`);
      });
    }

    // Now look for PDF chunks (they should start around ID 1000+)
    console.log("\n📄 Looking for PDF chunks (ID 1000+):");

    try {
      const pdfScrollResult = await client.scroll(collectionName, {
        limit: 10,
        with_payload: true,
        filter: {
          must: [
            {
              key: "type",
              match: {
                value: "pdf"
              }
            }
          ]
        }
      });

      if (pdfScrollResult.points && pdfScrollResult.points.length > 0) {
        console.log(`Found ${pdfScrollResult.points.length} PDF chunks:`);
        pdfScrollResult.points.forEach((point: any, index: number) => {
          console.log(`\n${index + 1}. Point ID: ${point.id}`);
          console.log(`   Source: ${point.payload?.source || 'Unknown'}`);
          console.log(`   Type: ${point.payload?.type || 'Unknown'}`);
          console.log(`   Chunk: ${point.payload?.chunk_index}/${point.payload?.total_chunks}`);
          console.log(`   Text preview: ${point.payload?.text?.substring(0, 150)}...`);
        });
      } else {
        console.log("❌ No PDF chunks found with type='pdf'");

        // Alternative: look for points with higher IDs
        console.log("\n🔍 Checking for points with ID 1000+:");
        const highIdResult = await client.scroll(collectionName, {
          limit: 5,
          with_payload: true,
          offset: 1000
        });

        if (highIdResult.points && highIdResult.points.length > 0) {
          highIdResult.points.forEach((point: any, index: number) => {
            console.log(`${index + 1}. ID: ${point.id} | Source: ${point.payload?.source || 'Unknown'}`);
          });
        } else {
          console.log("No points found with high IDs either");
        }
      }
    } catch (filterError) {
      console.log("Filter search failed, trying alternative approach...");
    }

    console.log(`\n📊 Total Points: ${collectionInfo.points_count}`);
    console.log("📊 This means you have:", collectionInfo.points_count - 16, "additional points beyond the original Q&A");

  } catch (error: any) {
    console.error("❌ Error checking storage:", error.message);
  }
}

checkPDFStorage();