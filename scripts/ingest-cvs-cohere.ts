import * as fs from 'fs';
import * as path from 'path';
import { QdrantClient } from '@qdrant/js-client-rest';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

async function generateEmbedding(text: string): Promise<number[]> {
  const cohereApiKey = process.env.COHERE_API_KEY;
  if (!cohereApiKey) {
    throw new Error('COHERE_API_KEY not found in environment variables');
  }

  const response = await fetch('https://api.cohere.ai/v1/embed', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${cohereApiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'embed-english-v3.0',
      texts: [text],
      input_type: 'search_document',
      embedding_types: ['float']
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Failed to generate embedding: ${response.status} - ${errorText}`);
  }

  const data = await response.json();
  return data.embeddings.float[0];
}

async function main() {
  console.log('🚀 Starting CV ingestion to Qdrant (Cohere)...\n');

  // Initialize Qdrant client
  const client = new QdrantClient({
    url: process.env.QDRANT_URL || 'http://localhost:6333',
  });

  const collectionName = process.env.QDRANT_COHERE_COLLECTION || 'cohere-search';

  // Detect embedding dimension by generating a test embedding
  console.log('🔍 Detecting embedding dimension...');
  const testEmbedding = await generateEmbedding('test');
  const vectorSize = testEmbedding.length;
  console.log(`✅ Cohere model produces ${vectorSize} dimensions\n`);

  // Check if collection exists
  let needsRecreate = false;
  try {
    const existingCollection = await client.getCollection(collectionName);
    const existingSize = existingCollection.config.params.vectors.size;

    if (existingSize !== vectorSize) {
      console.log(`⚠️  Dimension mismatch: existing=${existingSize}, new=${vectorSize}`);
      console.log(`🗑️  Deleting old collection...`);
      await client.deleteCollection(collectionName);
      needsRecreate = true;
    } else {
      console.log(`✅ Collection '${collectionName}' already exists with correct dimensions\n`);
    }
  } catch (error) {
    needsRecreate = true;
  }

  if (needsRecreate) {
    console.log(`📦 Creating collection: ${collectionName} (${vectorSize}D)`);
    await client.createCollection(collectionName, {
      vectors: {
        size: vectorSize,
        distance: 'Cosine',
      },
    });
    console.log(`✅ Created collection: ${collectionName}\n`);
  }

  // Read all CV files
  const cvsDir = path.join(process.cwd(), 'cvs');
  if (!fs.existsSync(cvsDir)) {
    console.error('❌ CVs directory not found. Please run generate-cvs.ts first.');
    process.exit(1);
  }

  const files = fs.readdirSync(cvsDir).filter(f => f.endsWith('.txt'));

  if (files.length === 0) {
    console.error('❌ No CV files found. Please run generate-cvs.ts first.');
    process.exit(1);
  }

  console.log(`📄 Found ${files.length} CV files\n`);

  const points: any[] = [];

  for (let i = 0; i < files.length; i++) {
    const filename = files[i];
    const filepath = path.join(cvsDir, filename);
    const content = fs.readFileSync(filepath, 'utf-8');

    console.log(`📝 Processing [${i + 1}/${files.length}]: ${filename}`);

    try {
      // Generate embedding for the entire CV
      const embedding = await generateEmbedding(content);

      // Extract metadata from filename: cv_01_ios_developer_english.txt
      const parts = filename.replace('.txt', '').split('_');
      const cvId = parseInt(parts[1]);
      const profileType = parts.slice(2, -1).join('_');
      const language = parts[parts.length - 1];

      const point = {
        id: cvId,
        vector: embedding,
        payload: {
          text: content,
          source: filename,
          type: 'cv',
          profile_type: profileType,
          language: language,
        },
      };

      points.push(point);
      console.log(`✅ Embedded: ${filename} (${language}, ${profileType})\n`);

      // Small delay to avoid rate limiting Cohere API
      await new Promise(resolve => setTimeout(resolve, 1000));
    } catch (error) {
      console.error(`❌ Failed to process ${filename}:`, error);
    }
  }

  // Upload all points to Qdrant
  if (points.length > 0) {
    console.log(`\n📤 Uploading ${points.length} CVs to Qdrant...`);
    await client.upsert(collectionName, {
      wait: true,
      points: points,
    });
    console.log(`✅ Successfully uploaded ${points.length} CVs to '${collectionName}' collection\n`);
  }

  // Verify collection
  const collectionInfo = await client.getCollection(collectionName);
  console.log(`\n📊 Collection Info:`);
  console.log(`   Name: ${collectionInfo.name}`);
  console.log(`   Vectors count: ${collectionInfo.points_count}`);
  console.log(`   Vector size: ${collectionInfo.config.params.vectors.size}`);

  console.log(`\n🎉 Ingestion complete!`);
  console.log(`\nYou can now test Cohere searches with the toggle in the UI`);
}

main().catch(console.error);