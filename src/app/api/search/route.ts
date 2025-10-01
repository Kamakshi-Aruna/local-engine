// Enhanced search API route with tool calling integration
import { NextRequest, NextResponse } from "next/server";
import { getCloudflareVectorStore } from "@/lib/cloudflareVectorStore";
import { initializeTools, detectToolsFromQuery, getToolSuggestions } from "@/lib/tools";
import { ToolContext } from "@/lib/tools/types";

// Initialize tools registry
const toolRegistry = initializeTools();

export async function POST(request: NextRequest) {
  try {
    const { query, useTools = true } = await request.json();

    if (!query) {
      return NextResponse.json(
        { error: "Query is required" },
        { status: 400 }
      );
    }

    let pdfResults: any = null;
    let toolResults: any[] | null = null;
    let combinedAnswer = "";

    // Always try PDF search first if vector store is configured
    try {
      const vectorStore = await getCloudflareVectorStore();
      pdfResults = await vectorStore.search(query, 3);
    } catch (vectorError) {
      console.log("📄 Vector search not available:", vectorError);
    }

    // Detect and execute tools if enabled
    if (useTools) {
      try {
        const suggestions = getToolSuggestions(query);

        if (suggestions.length > 0) {
          toolResults = [];

          // Execute top tool suggestions
          for (const suggestion of suggestions.slice(0, 2)) { // Limit to top 2
            if (suggestion.confidence > 0.7) {
              const context: ToolContext = {
                requestId: Date.now().toString(),
                sessionId: request.headers.get('x-session-id') || undefined,
                userId: request.headers.get('x-user-id') || undefined
              };

              const toolCall = {
                toolName: suggestion.tool,
                parameters: suggestion.suggested_params || {},
                id: Date.now().toString()
              };

              const result = await toolRegistry.executeTool(toolCall, context);
              if (result.success) {
                toolResults.push({
                  tool: suggestion.tool,
                  confidence: suggestion.confidence,
                  result: result
                });
              }
            }
          }
        }
      } catch (toolError) {
        console.log("🔧 Tool execution error:", toolError);
      }
    }

    // Combine results intelligently - prioritize live tools over documents
    if (toolResults && toolResults.length > 0) {
      // Check if we have high-confidence calculator results
      const hasCalculator = toolResults.some(tr => tr.tool === 'calculate' && tr.confidence > 0.7);

      const toolAnswers = toolResults.map(tr => {
        const data = tr.result.data;
        switch (tr.tool) {
          case 'get_weather':
            return `Current weather in ${data.location}: ${data.temperature}${data.units.temperature}, ${data.description}. Humidity: ${data.humidity}%, Wind: ${data.wind_speed} ${data.units.wind_speed}.`;

          case 'get_news':
            const articles = data.articles.slice(0, 3);
            return `Latest news: ${articles.map((a: any) => `• ${a.title} (${a.source})`).join(' ')}`;

          case 'get_stock_price':
            return `${data.symbol}: $${data.price} (${data.change > 0 ? '+' : ''}${data.change.toFixed(2)}, ${data.changePercent}) as of ${data.lastTradingDay}`;

          case 'get_time':
            return `Current time: ${data.time} (${data.timezone})`;

          case 'calculate':
            return `${data.expression} = ${data.result}`;

          default:
            return `${tr.tool}: ${JSON.stringify(data)}`;
        }
      }).join('\n\n');

      // If we have calculator results, prioritize them
      if (hasCalculator) {
        combinedAnswer = toolAnswers;
        // Add PDF context only if relevant and not conflicting
        if (pdfResults?.success && pdfResults.answer && !pdfResults.answer.includes('calculation')) {
          combinedAnswer += '\n\n---\n\nRelated from documents:\n' + pdfResults.answer;
        }
      } else {
        // For non-calculator tools, blend with PDF results
        combinedAnswer = toolAnswers;
        if (pdfResults?.success && pdfResults.answer) {
          combinedAnswer += '\n\n---\n\nFrom documents:\n' + pdfResults.answer;
        }
      }
    } else if (pdfResults?.success && pdfResults.answer) {
      // Only use PDF results if no tools were executed
      combinedAnswer = pdfResults.answer;
    }

    // If no results from either source
    if (!combinedAnswer) {
      combinedAnswer = "I couldn't find relevant information in the uploaded documents or external data sources for your query.";
    }

    return NextResponse.json({
      success: true,
      answer: combinedAnswer,
      query: query,
      sources: {
        pdf: pdfResults?.sources || [],
        tools: toolResults || []
      },
      hasToolResults: toolResults && toolResults.length > 0,
      hasPdfResults: pdfResults?.success || false
    });

  } catch (error) {
    console.error("❌ Enhanced search error:", error);
    return NextResponse.json(
      {
        error: "Search failed",
        details: error instanceof Error ? error.message : "Unknown error"
      },
      { status: 500 }
    );
  }
}