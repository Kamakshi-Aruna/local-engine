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

    const geminiApiKey = process.env.GEMINI_API_KEY;
    if (!geminiApiKey) {
      return NextResponse.json(
        { error: "Gemini API key not configured" },
        { status: 500 }
      );
    }

    const { client, collectionName } = await getVectorStore('gemini');

    try {
      await client.getCollection(collectionName);
    } catch (error) {
      return NextResponse.json({
        success: true,
        results: [],
        message: "No CVs found. Please ingest CVs first.",
      });
    }

    // Use Gemini embedding model for vector search
    const embeddingResponse = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/text-embedding-004:embedContent?key=${geminiApiKey}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        content: {
          parts: [{ text: query }]
        }
      }),
    });

    if (!embeddingResponse.ok) {
      throw new Error(`Failed to generate embedding: ${embeddingResponse.status}`);
    }

    const embeddingData = await embeddingResponse.json();
    const queryEmbedding = embeddingData.embedding.values;

    if (!queryEmbedding || queryEmbedding.length === 0) {
      throw new Error("Generated embedding is null or empty");
    }

    console.log(`🔍 Query: "${query}"`);
    console.log(`📊 Gemini embedding dimension: ${queryEmbedding.length}`);

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

    async function extractSkillsWithGemini(cvText: string, query: string): Promise<string[]> {
      try {
        console.log(`🔧 Extracting skills with Gemini for query: "${query}"`);
        const geminiModel = process.env.GEMINI_GENERATION_MODEL || 'gemini-2.0-flash';
        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${geminiModel}:generateContent?key=${geminiApiKey}`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            contents: [{
              parts: [{
                text: `List technical skills from CV for "${query}":\n\n${cvText.slice(0, 1200)}\n\nSkills (comma-separated):`
              }]
            }],
            generationConfig: {
              temperature: 0,
              maxOutputTokens: 80,
              topP: 0.95,
              topK: 20
            },
            safetySettings: [
              { category: "HARM_CATEGORY_HARASSMENT", threshold: "BLOCK_NONE" },
              { category: "HARM_CATEGORY_HATE_SPEECH", threshold: "BLOCK_NONE" },
              { category: "HARM_CATEGORY_SEXUALLY_EXPLICIT", threshold: "BLOCK_NONE" },
              { category: "HARM_CATEGORY_DANGEROUS_CONTENT", threshold: "BLOCK_NONE" }
            ]
          }),
        });

        if (!response.ok) {
          const errorText = await response.text();
          console.error(`❌ Gemini API error: ${response.status} - ${errorText}`);
          return [];
        }

        const data = await response.json();
        console.log(`📦 Gemini raw response:`, JSON.stringify(data, null, 2));

        const skillsText = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || "";
        console.log(`✅ Gemini skills text:`, skillsText);

        if (skillsText && skillsText !== "None" && skillsText.length > 0) {
          // Clean up the response - remove common prefixes and extra formatting
          let cleanedText = skillsText
            .replace(/^(Skills?|Technical Skills?|Relevant Skills?):\s*/i, '')
            .replace(/\*\*/g, '') // Remove markdown bold
            .replace(/\n\n/g, ',')
            .replace(/\n/g, ',')
            .replace(/\s*,\s*/g, ','); // Normalize comma spacing

          const skills = cleanedText
            .split(',')
            .map((s: string) => s.trim())
            .filter((s: string) =>
              s.length > 0 &&
              s.length < 50 && // Skip very long strings
              !s.match(/^(Here|The|Based|Relevant|Extract|Query|CV|Text|Return)/i)
            )
            .slice(0, 10); // Limit to top 10 skills

          console.log(`📝 Extracted ${skills.length} skills:`, skills);
          return skills;
        }

        console.log(`⚠️  No skills extracted from response`);
      } catch (error) {
        console.error("❌ Gemini skill extraction error:", error);
        if (error instanceof Error) {
          console.error("Error details:", error.message);
        }
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

        const matchedSkills = await extractSkillsWithGemini(cvText, query);

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
      message: `Found ${results.length} candidate(s) (Gemini)`,
      query: query,
      results: results
    });

  } catch (error) {
    console.error("❌ Gemini search error:", error);
    return NextResponse.json(
      {
        error: "Search failed",
        details: error instanceof Error ? error.message : "Unknown error"
      },
      { status: 500 }
    );
  }
}