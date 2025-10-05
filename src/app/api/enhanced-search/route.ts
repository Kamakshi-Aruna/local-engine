import { NextRequest, NextResponse } from "next/server";
import { SemanticSearchService } from "@/lib/semanticSearch";
import { getDocumentCount } from "@/lib/vectorStore";
import { GoogleGenerativeAI } from '@google/generative-ai';

export async function POST(request: NextRequest) {
  try {
    const { query, useEnhancedSearch = true, rerankingEnabled = true } = await request.json();

    if (!query) {
      return NextResponse.json(
        { error: "Query is required" },
        { status: 400 }
      );
    }

    // Check if we have any documents
    const documentCount = getDocumentCount();
    console.log(`Search request for: "${query}". Document count: ${documentCount}`);

    if (documentCount === 0) {
      return NextResponse.json({
        success: true,
        answer: "No documents have been uploaded yet. Please upload some PDF documents first.",
        query: query,
        searchMethod: "none",
        totalDocuments: 0
      });
    }

    // Initialize search service
    const searchService = new SemanticSearchService();

    // Perform search based on settings
    let searchResult;
    if (rerankingEnabled) {
      searchResult = await searchService.searchWithReranking(query, 5, useEnhancedSearch);
    } else if (useEnhancedSearch) {
      searchResult = await searchService.enhancedSearch(query, 5);
    } else {
      searchResult = await searchService.basicSearch(query, 5);
    }

    if (!searchResult.results || searchResult.results.length === 0) {
      return NextResponse.json({
        success: true,
        answer: "I couldn't find any relevant information for your query. Try using different keywords or phrases.",
        query: query,
        expandedTerms: searchResult.expandedTerms,
        searchMethod: searchResult.searchMethod,
        totalDocuments: documentCount
      });
    }

    // Prepare sources for response
    const sources = searchResult.results.map((result: any) => ({
      text: result.text || "",
      source: result.source || "unknown",
      chunkIndex: result.chunkIndex || 0,
      score: result.rerankScore || result.score || 0,
      originalScore: result.originalScore || result.score || 0
    })).filter((item: any) => item.text.length > 0);

    // Combine relevant texts for AI response
    const relevantTexts = sources.slice(0, 3).map(s => s.text).join("\n\n---\n\n");

    // Group results by file to avoid duplicates
    const uniqueFiles = new Map();

    sources.forEach(source => {
      if (!uniqueFiles.has(source.source)) {
        uniqueFiles.set(source.source, source);
      } else {
        // If we already have this file, combine the text to get more complete info
        const existing = uniqueFiles.get(source.source);
        existing.text = existing.text + '\n' + source.text;
      }
    });

    const uniqueSources = Array.from(uniqueFiles.values());

    // Extract names and skills from unique sources
    function extractNameAndSkills(text: string, filename: string) {
      let name = '';
      let skills = '';

      // Extract name - look for explicit NAME field first
      const nameMatch = text.match(/NAME\s*:\s*([A-Z][A-Za-z\s]+?)(?:\s*\n|\s*CONTACT|\s*EMAIL|\s*$)/i);
      if (nameMatch) {
        name = nameMatch[1].trim().replace(/\s+/g, ' ');
      } else {
        // Try to extract from email
        const emailMatch = text.match(/([a-z]+)[._]?([a-z]*)\d*@/i);
        if (emailMatch) {
          const firstName = emailMatch[1].charAt(0).toUpperCase() + emailMatch[1].slice(1);
          const lastName = emailMatch[2] ? emailMatch[2].charAt(0).toUpperCase() + emailMatch[2].slice(1) : '';
          name = lastName ? `${firstName} ${lastName}` : firstName;
        } else {
          // Extract from filename and clean it up
          name = filename
            .replace('.pdf', '')
            .replace(/_/g, ' ')
            .replace(/resume|cv/gi, '')
            .replace(/\d+/g, '')
            .trim()
            .replace(/\s+/g, ' ');
        }
      }

      // Extract skills - look for technical skills sections
      const skillsPatterns = [
        /(?:Technical\s*Skills|Skills|Technologies)[:\s]*([^]+?)(?=\n[A-Z][a-z]+:|Education|Experience|Projects|$)/i,
        /(?:Frontend|Backend|Languages|Tools)[:\s]*([^]+?)(?=\n[A-Z][a-z]+:|$)/i
      ];

      for (const pattern of skillsPatterns) {
        const match = text.match(pattern);
        if (match) {
          skills = match[1]
            .replace(/[•\-\*]/g, '')
            .replace(/\s+/g, ' ')
            .replace(/\n+/g, ', ')
            .trim();
          break;
        }
      }

      return { name, skills };
    }

    const answerText = `Backend Developer Names:

${uniqueSources.map((source, i) => {
      const { name } = extractNameAndSkills(source.text, source.source);
      return `${i + 1}. ${name}`;
    }).join('\n')}`;

    return NextResponse.json({
      success: true,
      answer: answerText,
      query: query,
      expandedTerms: searchResult.expandedTerms,
      sources: sources.map(s => ({
        file: s.source,
        chunk: s.chunkIndex,
        score: s.score,
        originalScore: s.originalScore,
        preview: s.text.substring(0, 150) + "..."
      })),
      searchMethod: searchResult.searchMethod,
      rerankingApplied: rerankingEnabled,
      totalDocuments: documentCount,
      resultsFound: searchResult.totalFound
    });

  } catch (error) {
    console.error("Enhanced search error:", error);
    return NextResponse.json(
      {
        error: "Search failed",
        details: error instanceof Error ? error.message : "Unknown error"
      },
      { status: 500 }
    );
  }
}