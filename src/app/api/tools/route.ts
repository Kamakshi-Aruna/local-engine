// Tool calling API route
import { NextRequest, NextResponse } from "next/server";
import { initializeTools, detectToolsFromQuery, getToolSuggestions } from "@/lib/tools";
import { ToolCall, ToolContext } from "@/lib/tools/types";

// Initialize tools registry
const toolRegistry = initializeTools();

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action, query, toolCall } = body;

    switch (action) {
      case 'detect':
        return handleDetectTools(query);

      case 'suggest':
        return handleSuggestTools(query);

      case 'execute':
        return handleExecuteTool(toolCall, request);

      case 'list':
        return handleListTools();

      default:
        return NextResponse.json(
          { error: "Invalid action. Use 'detect', 'suggest', 'execute', or 'list'" },
          { status: 400 }
        );
    }
  } catch (error) {
    console.error("❌ Tools API error:", error);
    return NextResponse.json(
      {
        error: "Tool operation failed",
        details: error instanceof Error ? error.message : "Unknown error"
      },
      { status: 500 }
    );
  }
}

async function handleDetectTools(query: string) {
  if (!query) {
    return NextResponse.json(
      { error: "Query is required for tool detection" },
      { status: 400 }
    );
  }

  const detectedTools = detectToolsFromQuery(query);
  const suggestions = getToolSuggestions(query);

  return NextResponse.json({
    success: true,
    query,
    detectedTools,
    suggestions
  });
}

async function handleSuggestTools(query: string) {
  if (!query) {
    return NextResponse.json(
      { error: "Query is required for tool suggestions" },
      { status: 400 }
    );
  }

  const suggestions = getToolSuggestions(query);

  return NextResponse.json({
    success: true,
    query,
    suggestions
  });
}

async function handleExecuteTool(toolCall: ToolCall, request: NextRequest) {
  if (!toolCall || !toolCall.toolName || !toolCall.parameters) {
    return NextResponse.json(
      { error: "Invalid tool call. Required: toolName, parameters, id" },
      { status: 400 }
    );
  }

  // Create execution context
  const context: ToolContext = {
    requestId: toolCall.id || Date.now().toString(),
    sessionId: request.headers.get('x-session-id') || undefined,
    userId: request.headers.get('x-user-id') || undefined
  };

  const result = await toolRegistry.executeTool(toolCall, context);

  return NextResponse.json({
    success: result.success,
    toolCall,
    result,
    executedAt: new Date().toISOString()
  });
}

async function handleListTools() {
  const tools = toolRegistry.getAllTools();
  const toolsByCategory = tools.reduce((acc, tool) => {
    if (!acc[tool.category]) {
      acc[tool.category] = [];
    }
    acc[tool.category].push(tool);
    return acc;
  }, {} as Record<string, any[]>);

  return NextResponse.json({
    success: true,
    tools,
    toolsByCategory,
    totalCount: tools.length
  });
}

export async function GET(request: NextRequest) {
  // GET request lists all available tools
  return handleListTools();
}