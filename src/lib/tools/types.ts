// Tool calling types and interfaces

export interface ToolParameter {
  name: string;
  type: 'string' | 'number' | 'boolean' | 'object' | 'array';
  description: string;
  required: boolean;
  default?: any;
  enum?: string[];
}

export interface ToolDefinition {
  name: string;
  description: string;
  parameters: ToolParameter[];
  category: string;
  requiresAuth?: boolean;
  rateLimit?: {
    calls: number;
    window: number; // seconds
  };
}

export interface ToolResult {
  success: boolean;
  data?: any;
  error?: string;
  source?: string;
  timestamp: number;
}

export interface ToolCall {
  toolName: string;
  parameters: Record<string, any>;
  id: string;
}

export interface ToolContext {
  userId?: string;
  sessionId?: string;
  requestId: string;
}

export abstract class BaseTool {
  abstract definition: ToolDefinition;

  abstract execute(
    parameters: Record<string, any>,
    context: ToolContext
  ): Promise<ToolResult>;

  validateParameters(parameters: Record<string, any>): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    // Check required parameters
    for (const param of this.definition.parameters) {
      if (param.required && !(param.name in parameters)) {
        errors.push(`Missing required parameter: ${param.name}`);
      }
    }

    // Check parameter types
    for (const [key, value] of Object.entries(parameters)) {
      const param = this.definition.parameters.find(p => p.name === key);
      if (!param) {
        errors.push(`Unknown parameter: ${key}`);
        continue;
      }

      if (!this.isValidType(value, param.type)) {
        errors.push(`Invalid type for parameter ${key}: expected ${param.type}`);
      }

      if (param.enum && !param.enum.includes(value)) {
        errors.push(`Invalid value for parameter ${key}: must be one of ${param.enum.join(', ')}`);
      }
    }

    return { valid: errors.length === 0, errors };
  }

  private isValidType(value: any, type: string): boolean {
    switch (type) {
      case 'string':
        return typeof value === 'string';
      case 'number':
        return typeof value === 'number';
      case 'boolean':
        return typeof value === 'boolean';
      case 'object':
        return typeof value === 'object' && value !== null && !Array.isArray(value);
      case 'array':
        return Array.isArray(value);
      default:
        return false;
    }
  }
}