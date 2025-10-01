// Tool registry for managing available tools

import { BaseTool, ToolDefinition, ToolResult, ToolCall, ToolContext } from './types';

export class ToolRegistry {
  private static instance: ToolRegistry;
  private tools: Map<string, BaseTool> = new Map();
  private rateLimits: Map<string, { calls: number[]; window: number }> = new Map();

  static getInstance(): ToolRegistry {
    if (!ToolRegistry.instance) {
      ToolRegistry.instance = new ToolRegistry();
    }
    return ToolRegistry.instance;
  }

  registerTool(tool: BaseTool): void {
    if (this.tools.has(tool.definition.name)) {
      // Tool already registered, skip silently
      return;
    }

    this.tools.set(tool.definition.name, tool);

    if (tool.definition.rateLimit) {
      this.rateLimits.set(tool.definition.name, {
        calls: [],
        window: tool.definition.rateLimit.window
      });
    }
  }

  getTool(name: string): BaseTool | undefined {
    return this.tools.get(name);
  }

  getAllTools(): ToolDefinition[] {
    return Array.from(this.tools.values()).map(tool => tool.definition);
  }

  getToolsByCategory(category: string): ToolDefinition[] {
    return this.getAllTools().filter(tool => tool.category === category);
  }

  async executeTool(toolCall: ToolCall, context: ToolContext): Promise<ToolResult> {
    const tool = this.getTool(toolCall.toolName);

    if (!tool) {
      return {
        success: false,
        error: `Tool ${toolCall.toolName} not found`,
        timestamp: Date.now()
      };
    }

    // Validate parameters
    const validation = tool.validateParameters(toolCall.parameters);
    if (!validation.valid) {
      return {
        success: false,
        error: `Parameter validation failed: ${validation.errors.join(', ')}`,
        timestamp: Date.now()
      };
    }

    // Check rate limits
    if (tool.definition.rateLimit) {
      const rateLimitCheck = this.checkRateLimit(toolCall.toolName);
      if (!rateLimitCheck.allowed) {
        return {
          success: false,
          error: `Rate limit exceeded. ${rateLimitCheck.message}`,
          timestamp: Date.now()
        };
      }
    }

    try {
      // Record the call for rate limiting
      if (tool.definition.rateLimit) {
        this.recordCall(toolCall.toolName);
      }

      const result = await tool.execute(toolCall.parameters, context);
      result.timestamp = Date.now();
      return result;
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred',
        timestamp: Date.now()
      };
    }
  }

  private checkRateLimit(toolName: string): { allowed: boolean; message: string } {
    const rateLimit = this.rateLimits.get(toolName);
    if (!rateLimit) {
      return { allowed: true, message: '' };
    }

    const tool = this.getTool(toolName);
    if (!tool?.definition.rateLimit) {
      return { allowed: true, message: '' };
    }

    const now = Date.now();
    const windowStart = now - (rateLimit.window * 1000);

    // Clean old calls
    rateLimit.calls = rateLimit.calls.filter(call => call > windowStart);

    if (rateLimit.calls.length >= tool.definition.rateLimit.calls) {
      const oldestCall = Math.min(...rateLimit.calls);
      const waitTime = Math.ceil((oldestCall + (rateLimit.window * 1000) - now) / 1000);
      return {
        allowed: false,
        message: `Please wait ${waitTime} seconds before making another call.`
      };
    }

    return { allowed: true, message: '' };
  }

  private recordCall(toolName: string): void {
    const rateLimit = this.rateLimits.get(toolName);
    if (rateLimit) {
      rateLimit.calls.push(Date.now());
    }
  }

  // Tool discovery methods
  searchTools(query: string): ToolDefinition[] {
    const searchTerm = query.toLowerCase();
    return this.getAllTools().filter(tool =>
      tool.name.toLowerCase().includes(searchTerm) ||
      tool.description.toLowerCase().includes(searchTerm) ||
      tool.category.toLowerCase().includes(searchTerm)
    );
  }

  // Get tools that can handle specific parameter types
  getToolsForParameters(parameterNames: string[]): ToolDefinition[] {
    return this.getAllTools().filter(tool => {
      const toolParams = tool.parameters.map(p => p.name.toLowerCase());
      return parameterNames.some(param =>
        toolParams.includes(param.toLowerCase())
      );
    });
  }
}