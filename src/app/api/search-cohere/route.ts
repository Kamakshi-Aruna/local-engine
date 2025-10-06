import { NextRequest, NextResponse } from "next/server";
import { getVectorStore } from "@/lib/vectorStore";

export async function POST(request: NextRequest) {
  try {
    const { query } = await request.json();

    if (!query) {
      return NextResponse.json(
        { error: "Query is required" },
        { status: 400 }
      );
    }

    const cohereApiKey = process.env.COHERE_API_KEY;
    if (!cohereApiKey) {
      return NextResponse.json(
        { error: "Cohere API key not configured" },
        { status: 500 }
      );
    }

    const { client, collectionName } = await getVectorStore('cohere');

    try {
      await client.getCollection(collectionName);
    } catch (error) {
      return NextResponse.json({
        success: true,
        results: [],
        message: "No CVs found. Please ingest CVs first.",
      });
    }

    // Use Cohere embedding model for vector search
    const embeddingResponse = await fetch("https://api.cohere.ai/v1/embed", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${cohereApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "embed-english-v3.0",
        texts: [query],
        input_type: "search_query",
        embedding_types: ["float"]
      }),
    });

    if (!embeddingResponse.ok) {
      throw new Error(`Failed to generate embedding: ${embeddingResponse.status}`);
    }

    const embeddingData = await embeddingResponse.json();
    const queryEmbedding = embeddingData.embeddings.float[0];

    if (!queryEmbedding || queryEmbedding.length === 0) {
      throw new Error("Generated embedding is null or empty");
    }

    console.log(`🔍 Query: "${query}"`);
    console.log(`📊 Cohere embedding dimension: ${queryEmbedding.length}`);

    const topNMatch = query.match(/top\s*(\d+)/i);
    const searchLimit = topNMatch ? parseInt(topNMatch[1]) : 20;

    // Extract language filter from query
    const languageMatch = query.match(/\b(english|spanish|french|italian|german)\s+(?:language|only)/i);
    const requestedLanguage = languageMatch ? languageMatch[1].toLowerCase() : null;

    const searchResult = await client.search(collectionName, {
      vector: queryEmbedding as number[],
      limit: searchLimit * 3,
      with_payload: true,
      score_threshold: 0.30, // Lower threshold for Cohere embeddings
    });

    console.log(`🔎 Vector search returned: ${searchResult.length} results`);
    if (searchResult.length > 0) {
      console.log(`📈 Top score: ${searchResult[0].score}`);
    }

    if (!searchResult || searchResult.length === 0) {
      return NextResponse.json({
        success: true,
        results: [],
        message: "No matching CVs found.",
      });
    }

    // Filter by language if specified
    let filteredResults = searchResult;
    if (requestedLanguage) {
      filteredResults = searchResult.filter((result: any) =>
        result.payload?.language?.toLowerCase() === requestedLanguage
      );
    }

    // Limit to requested number
    filteredResults = filteredResults.slice(0, searchLimit);

    if (filteredResults.length === 0) {
      return NextResponse.json({
        success: true,
        results: [],
        message: `No matching CVs found in ${requestedLanguage} language.`,
      });
    }

    function extractName(cvText: string): string {
      const lines = cvText.split('\n');
      for (const line of lines.slice(0, 15)) {
        let trimmed = line.trim();
        trimmed = trimmed.replace(/\*\*/g, '');

        if (trimmed.match(/^(?:Full Name|Name|Nombre|Nome|Nom).*?:/i)) {
          const nameMatch = trimmed.match(/:\s*(.+?)$/);
          if (nameMatch) {
            const name = nameMatch[1].trim();
            if (name && name.length > 0) return name;
          }
        }

        const namePattern = /^[A-Z][a-z]+(\s+[A-Z]\.?)?(\s+[A-Z][a-z]+){1,2}$/;
        if (trimmed &&
            namePattern.test(trimmed) &&
            !trimmed.includes(':') &&
            trimmed.length < 40) {
          return trimmed;
        }
      }
      return "Unknown";
    }

    async function extractSkillsWithCohere(cvText: string, query: string): Promise<string[]> {
      try {
        console.log(`🔧 Extracting skills with Cohere Chat API...`);
        const response = await fetch("https://api.cohere.ai/v1/chat", {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${cohereApiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: "command-a-03-2025",
            message: `Extract ONLY technical skills from this CV that match the query. Return as comma-separated list with NO explanation.

Query: "${query}"
CV: ${cvText.slice(0, 1500)}

Skills:`,
            temperature: 0.3,
          }),
        });

        if (!response.ok) {
          const errorText = await response.text();
          console.error(`❌ Cohere API error: ${response.status} - ${errorText}`);
          return [];
        }

        const data = await response.json();
        console.log(`✅ Cohere response:`, data.text);

        let skillsText = data.text?.trim() || "";

        skillsText = skillsText.replace(/^.*?:\s*/i, '');
        skillsText = skillsText.replace(/\n\n/g, ',').replace(/\n/g, ',');

        if (skillsText && skillsText !== "None") {
          const skills = skillsText.split(',').map((s: string) => s.trim()).filter((s: string) => s.length > 0 && !s.match(/^(Here|The|Based|Relevant)/i));
          console.log(`📝 Extracted skills:`, skills);
          return skills;
        }

        console.log(`⚠️  No skills found`);
      } catch (error) {
        console.error("❌ Cohere skill extraction error:", error);
      }

      return [];
    }

    const results = await Promise.all(
      filteredResults.map(async (result: any, index: number) => {
        const cvText = result.payload?.text || "";
        const name = extractName(cvText);
        const profileType = result.payload?.profile_type || "unknown";
        const language = result.payload?.language || "unknown";
        const score = result.score || 0;

        const roleTitle = profileType
          .split('_')
          .map((word: string) => word.charAt(0).toUpperCase() + word.slice(1))
          .join(' ');

        const matchedSkills = await extractSkillsWithCohere(cvText, query);

        return {
          rank: index + 1,
          name: name,
          role: roleTitle,
          language: language.charAt(0).toUpperCase() + language.slice(1),
          match_score: Math.round(score * 100),
          matched_skills: matchedSkills,
          file: result.payload?.source || "unknown"
        };
      })
    );

    return NextResponse.json({
      success: true,
      message: `Found ${results.length} candidate(s) (Cohere)`,
      query: query,
      results: results
    });

  } catch (error) {
    console.error("❌ Cohere search error:", error);
    return NextResponse.json(
      {
        error: "Search failed",
        details: error instanceof Error ? error.message : "Unknown error"
      },
      { status: 500 }
    );
  }
}