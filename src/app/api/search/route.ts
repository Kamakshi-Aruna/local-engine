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

    const { client, collectionName } = await getVectorStore();

    try {
      await client.getCollection(collectionName);
    } catch (error) {
      return NextResponse.json({
        success: true,
        results: [],
        message: "No CVs found. Please ingest CVs first.",
      });
    }

    const embeddingResponse = await fetch("http://localhost:11434/api/embeddings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: process.env.OLLAMA_EMBEDDING_MODEL || "nomic-embed-text",
        prompt: query,
      }),
    });

    if (!embeddingResponse.ok) {
      throw new Error(`Failed to generate embedding: ${embeddingResponse.status}`);
    }

    const embeddingData = await embeddingResponse.json();
    const queryEmbedding = embeddingData.embedding;

    if (!queryEmbedding || queryEmbedding.length === 0) {
      throw new Error("Generated embedding is null or empty");
    }

    console.log(`🔍 Query: "${query}"`);
    console.log(`📊 Embedding dimension: ${queryEmbedding.length}`);

    const topNMatch = query.match(/top\s*(\d+)/i);
    const searchLimit = topNMatch ? parseInt(topNMatch[1]) : 20;

    // Extract language filter from query
    const languageMatch = query.match(/\b(english|spanish|french|italian|german)\s+(?:language|only)/i);
    const requestedLanguage = languageMatch ? languageMatch[1].toLowerCase() : null;

    const searchResult = await client.search(collectionName, {
      vector: queryEmbedding as number[],
      limit: searchLimit * 3, // Get more results to account for filtering
      with_payload: true,
      score_threshold: 0.50, // Higher threshold to avoid irrelevant results
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

        // Strip all markdown bold markers
        trimmed = trimmed.replace(/\*\*/g, '');

        // Check for name with label (Name:, Full Name:, etc.)
        if (trimmed.match(/^(?:Full Name|Name|Nombre|Nome|Nom).*?:/i)) {
          const nameMatch = trimmed.match(/:\s*(.+?)$/);
          if (nameMatch) {
            const name = nameMatch[1].trim();
            if (name && name.length > 0) return name;
          }
        }

        // Check for name-like pattern (supports middle initials)
        // Must be 2-4 words, no colons, and typical name length
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

    async function isRelevantCandidate(cvText: string, query: string): Promise<boolean> {
      try {
        const response = await fetch("http://localhost:11434/api/generate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            model: process.env.OLLAMA_LLM_MODEL || "llama3",
            prompt: `Is this CV relevant to the search query? Answer only YES or NO.

Query: "${query}"
CV Summary: ${cvText.slice(0, 500)}

Answer (YES/NO):`,
            stream: false,
          }),
        });

        if (response.ok) {
          const data = await response.json();
          const answer = data.response?.trim().toUpperCase();
          return answer?.includes("YES") || false;
        }
      } catch (error) {
        console.error("Relevance check error:", error);
      }
      return true; // Default to true if check fails
    }

    async function extractSkillsWithLLM(cvText: string, query: string): Promise<string[]> {
      try {
        const response = await fetch("http://localhost:11434/api/generate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            model: process.env.OLLAMA_LLM_MODEL || "llama3",
            prompt: `You are a skill extractor. Extract ONLY technical skills from the CV that match the query.

Query: "${query}"
CV: ${cvText.slice(0, 1500)}

CRITICAL: Return skills as comma-separated values with NO explanation, NO preamble, NO extra text.
Example output: Swift, UIKit, Core Data

If no skills match, return: None`,
            stream: false,
          }),
        });

        if (response.ok) {
          const data = await response.json();
          let skillsText = data.response?.trim() || "";

          // Remove common preambles and clean up
          skillsText = skillsText.replace(/^.*?:\s*/i, ''); // Remove "Here are the skills:" type prefixes
          skillsText = skillsText.replace(/\n\n/g, ',').replace(/\n/g, ',');

          if (skillsText && skillsText !== "None") {
            return skillsText.split(',').map((s: string) => s.trim()).filter((s: string) => s.length > 0 && !s.match(/^(Here|The|Based|Relevant)/i));
          }
        }
      } catch (error) {
        console.error("Skill extraction error:", error);
      }

      return [];
    }

    const validatedResults = await Promise.all(
      filteredResults.map(async (result: any) => {
        const cvText = result.payload?.text || "";

        // Check if CV is actually relevant using LLM
        // const isRelevant = await isRelevantCandidate(cvText, query);

        // if (!isRelevant) {
        //   return null; // Filter out irrelevant results
        // }

        const name = extractName(cvText);
        const profileType = result.payload?.profile_type || "unknown";
        const language = result.payload?.language || "unknown";
        const score = result.score || 0;

        const roleTitle = profileType
          .split('_')
          .map((word: string) => word.charAt(0).toUpperCase() + word.slice(1))
          .join(' ');

        const matchedSkills = await extractSkillsWithLLM(cvText, query);

        return {
          name: name,
          role: roleTitle,
          language: language.charAt(0).toUpperCase() + language.slice(1),
          match_score: Math.round(score * 100),
          matched_skills: matchedSkills,
          file: result.payload?.source || "unknown"
        };
      })
    );

    // Filter out null results and add rank
    const results = validatedResults
      .filter((r): r is NonNullable<typeof r> => r !== null)
      .map((result, index) => ({
        rank: index + 1,
        ...result
      }));

    return NextResponse.json({
      success: true,
      message: `Found ${results.length} candidate(s)`,
      query: query,
      results: results
    });

  } catch (error) {
    console.error("❌ Search error:", error);
    return NextResponse.json(
      {
        error: "Search failed",
        details: error instanceof Error ? error.message : "Unknown error"
      },
      { status: 500 }
    );
  }
}