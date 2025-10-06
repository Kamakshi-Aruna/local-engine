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

    const openaiApiKey = process.env.OPENAI_API_KEY;
    if (!openaiApiKey) {
      return NextResponse.json(
        { error: "OpenAI API key not configured" },
        { status: 500 }
      );
    }

    const { client, collectionName } = await getVectorStore('openai');

    try {
      await client.getCollection(collectionName);
    } catch (error) {
      return NextResponse.json({
        success: true,
        results: [],
        message: "No CVs found. Please ingest CVs first.",
      });
    }

    // Use OpenAI embedding model for vector search
    const embeddingResponse = await fetch("https://api.openai.com/v1/embeddings", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${openaiApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "text-embedding-3-large",
        input: query,
      }),
    });

    if (!embeddingResponse.ok) {
      throw new Error(`Failed to generate embedding: ${embeddingResponse.status}`);
    }

    const embeddingData = await embeddingResponse.json();
    const queryEmbedding = embeddingData.data[0].embedding;

    if (!queryEmbedding || queryEmbedding.length === 0) {
      throw new Error("Generated embedding is null or empty");
    }

    console.log(`🔍 Query: "${query}"`);
    console.log(`📊 OpenAI embedding dimension: ${queryEmbedding.length}`);

    const topNMatch = query.match(/top\s*(\d+)/i);
    const searchLimit = topNMatch ? parseInt(topNMatch[1]) : 20;

    // Extract language filter from query
    const languageMatch = query.match(/\b(english|spanish|french|italian|german)\s+(?:language|only)/i);
    const requestedLanguage = languageMatch ? languageMatch[1].toLowerCase() : null;

    const searchResult = await client.search(collectionName, {
      vector: queryEmbedding as number[],
      limit: searchLimit * 3,
      with_payload: true,
      score_threshold: 0.30,
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

    async function extractSkillsWithOpenAI(cvText: string, query: string): Promise<string[]> {
      try {
        console.log(`🔧 Extracting skills with OpenAI...`);
        const response = await fetch("https://api.openai.com/v1/chat/completions", {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${openaiApiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: "gpt-4o-mini",
            messages: [
              {
                role: "system",
                content: "You are a skill extractor. Extract ONLY technical skills from CVs that match the query. Return as comma-separated list with NO explanation."
              },
              {
                role: "user",
                content: `Query: "${query}"\nCV: ${cvText.slice(0, 1500)}\n\nSkills:`
              }
            ],
            temperature: 0.3,
            max_tokens: 100,
          }),
        });

        if (!response.ok) {
          const errorText = await response.text();
          console.error(`❌ OpenAI API error: ${response.status} - ${errorText}`);
          return [];
        }

        const data = await response.json();
        const skillsText = data.choices[0]?.message?.content?.trim() || "";
        console.log(`✅ OpenAI response:`, skillsText);

        if (skillsText && skillsText !== "None") {
          const cleanedText = skillsText.replace(/^.*?:\s*/i, '').replace(/\n\n/g, ',').replace(/\n/g, ',');
          const skills = cleanedText.split(',').map((s: string) => s.trim()).filter((s: string) => s.length > 0 && !s.match(/^(Here|The|Based|Relevant)/i));
          console.log(`📝 Extracted skills:`, skills);
          return skills;
        }

        console.log(`⚠️  No skills found`);
      } catch (error) {
        console.error("❌ OpenAI skill extraction error:", error);
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

        const matchedSkills = await extractSkillsWithOpenAI(cvText, query);

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
      message: `Found ${results.length} candidate(s) (OpenAI)`,
      query: query,
      results: results
    });

  } catch (error) {
    console.error("❌ OpenAI search error:", error);
    return NextResponse.json(
      {
        error: "Search failed",
        details: error instanceof Error ? error.message : "Unknown error"
      },
      { status: 500 }
    );
  }
}