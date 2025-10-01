// Client-side tool calling utilities

import { ToolCall, ToolResult } from './tools/types';

export interface ToolSuggestion {
  tool: string;
  confidence: number;
  suggested_params?: Record<string, any>;
}

export interface ToolDetectionResult {
  success: boolean;
  query: string;
  detectedTools: string[];
  suggestions: ToolSuggestion[];
}

export interface ToolExecutionResult {
  success: boolean;
  toolCall: ToolCall;
  result: ToolResult;
  executedAt: string;
}

export class ToolsClient {
  private baseUrl: string;

  constructor(baseUrl: string = '/api/tools') {
    this.baseUrl = baseUrl;
  }

  async detectTools(query: string): Promise<ToolDetectionResult> {
    const response = await fetch(this.baseUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        action: 'detect',
        query
      })
    });

    if (!response.ok) {
      throw new Error(`Tool detection failed: ${response.status}`);
    }

    return response.json();
  }

  async executeTool(toolCall: ToolCall): Promise<ToolExecutionResult> {
    const response = await fetch(this.baseUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        action: 'execute',
        toolCall
      })
    });

    if (!response.ok) {
      throw new Error(`Tool execution failed: ${response.status}`);
    }

    return response.json();
  }

  async listTools(): Promise<{ success: boolean; tools: any[]; toolsByCategory: Record<string, any[]> }> {
    const response = await fetch(this.baseUrl, {
      method: 'GET'
    });

    if (!response.ok) {
      throw new Error(`Failed to list tools: ${response.status}`);
    }

    return response.json();
  }

  // Helper method to execute a tool with simple parameters
  async executeSimpleTool(toolName: string, parameters: Record<string, any>): Promise<ToolExecutionResult> {
    const toolCall: ToolCall = {
      toolName,
      parameters,
      id: Date.now().toString()
    };

    return this.executeTool(toolCall);
  }

  // Auto-detect and execute tools based on a query
  async autoExecute(query: string): Promise<{
    detection: ToolDetectionResult;
    executions: ToolExecutionResult[];
  }> {
    const detection = await this.detectTools(query);
    const executions: ToolExecutionResult[] = [];

    // Execute the highest confidence suggestions
    for (const suggestion of detection.suggestions.slice(0, 3)) { // Limit to top 3
      if (suggestion.confidence > 0.7) {
        try {
          const execution = await this.executeSimpleTool(
            suggestion.tool,
            suggestion.suggested_params || {}
          );
          executions.push(execution);
        } catch (error) {
          console.error(`Failed to execute tool ${suggestion.tool}:`, error);
        }
      }
    }

    return { detection, executions };
  }
}

// Create a default instance
export const toolsClient = new ToolsClient();