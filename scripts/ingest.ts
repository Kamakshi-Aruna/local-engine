import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';
import { QdrantClient } from '@qdrant/js-client-rest';
import { OllamaEmbedding } from 'llamaindex';
import { v4 as uuidv4 } from 'uuid';

// Load environment variables
dotenv.config({ path: '.env.local' });

async function ingestCVs() {
  try {
    console.log('Starting CV ingestion process...');

    // Initialize Ollama embeddings
    const embedModel = new OllamaEmbedding({
      model: process.env.OLLAMA_MODEL || 'llama3',
      baseURL: process.env.OLLAMA_BASE_URL || 'http://localhost:11434'
    });

    // Path to CV files
    const cvDirectory = path.join(process.cwd(), 'data', 'ai-cvs');

    // Read all CV files
    const files = fs.readdirSync(cvDirectory).filter(file => file.endsWith('.txt'));
    console.log(`Found ${files.length} CV files to process`);

    if (files.length === 0) {
      console.log('No CV files found in data/ai-cvs/');
      return;
    }

    // Process CV files
    const documents = [];
    for (const file of files) {
      const filePath = path.join(cvDirectory, file);
      const content = fs.readFileSync(filePath, 'utf-8');

      // Skip empty files
      if (content.trim().length === 0) {
        console.log(`Skipping empty file: ${file}`);
        continue;
      }

      // Extract candidate name from filename
      const candidateName = file.replace('cv_', '').replace('.txt', '').replace(/_/g, ' ');

      documents.push({
        filename: file,
        content: content,
        candidateName: candidateName,
        filePath: filePath
      });

      console.log(`Processed: ${file}`);
    }

    console.log(`Successfully processed ${documents.length} CV documents`);

    // Initialize Qdrant client
    console.log('Setting up Qdrant collection...');
    const qdrantClient = new QdrantClient({
      url: process.env.QDRANT_URL || 'http://localhost:6333'
    });

    const collectionName = process.env.QDRANT_COLLECTION || 'cv_collection';

    // Check if collection exists
    try {
      const collectionInfo = await qdrantClient.getCollection(collectionName);
      console.log(`Collection "${collectionName}" already exists with ${collectionInfo.points_count} points`);

      // Optionally delete and recreate to start fresh
      console.log('Deleting existing collection to start fresh...');
      await qdrantClient.deleteCollection(collectionName);
      console.log('Collection deleted');
    } catch (error) {
      // Collection doesn't exist, which is fine
    }

    // Create collection
    console.log(`Creating collection "${collectionName}"...`);

    // Get embedding dimension
    const testEmbedding = await embedModel.getTextEmbedding("test");
    const vectorSize = testEmbedding.length;

    await qdrantClient.createCollection(collectionName, {
      vectors: {
        size: vectorSize,
        distance: 'Cosine'
      }
    });
    console.log(`Created collection with vector size: ${vectorSize}`);

    // Generate embeddings and create points
    console.log('Generating embeddings and preparing data...');
    const points = [];

    for (const doc of documents) {
      console.log(`  Generating embedding for ${doc.filename}...`);

      // Generate embedding for the CV content
      const embedding = await embedModel.getTextEmbedding(doc.content);

      // Create point with embedding and payload
      const point = {
        id: uuidv4(),
        vector: embedding,
        payload: {
          text: doc.content,
          metadata: {
            filename: doc.filename,
            candidate_name: doc.candidateName,
            file_path: doc.filePath,
            type: 'cv'
          }
        }
      };

      points.push(point);
    }

    // Insert points into Qdrant
    console.log(`Inserting ${points.length} points into Qdrant...`);

    const result = await qdrantClient.upsert(collectionName, {
      wait: true,
      points: points
    });

    console.log('Upsert operation completed:', result);

    // Verify ingestion
    const finalInfo = await qdrantClient.getCollection(collectionName);

    console.log('\n✅ Successfully ingested all CVs to vector database!');
    console.log(`📊 Total documents processed: ${documents.length}`);
    console.log(`🔍 CVs are now searchable in collection: ${collectionName}`);
    console.log(`📈 Total points in collection: ${finalInfo.points_count}`);

    if (finalInfo.points_count === 0) {
      console.log('\n⚠️  WARNING: No points were actually stored. Check Qdrant logs for errors.');
    } else {
      // Show what was stored
      console.log('\n📄 Stored CVs:');
      const scrollResult = await qdrantClient.scroll(collectionName, {
        limit: 10,
        with_payload: true,
        with_vector: false
      });

      scrollResult.points.forEach((point, idx) => {
        const metadata = point.payload?.metadata;
        console.log(`   ${idx + 1}. ${metadata?.filename || 'Unknown'} - ${metadata?.candidate_name || 'Unknown'}`);
      });
    }

  } catch (error) {
    console.error('❌ Error during CV ingestion:', error);
    process.exit(1);
  }
}

// Run the ingestion
ingestCVs();