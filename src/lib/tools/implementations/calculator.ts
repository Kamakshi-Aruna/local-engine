// Calculator tool implementation for mathematical operations

import { BaseTool, ToolDefinition, ToolResult, ToolContext } from '../types';

export class CalculatorTool extends BaseTool {
  definition: ToolDefinition = {
    name: 'calculate',
    description: 'Perform mathematical calculations with basic and advanced operations',
    category: 'utility',
    parameters: [
      {
        name: 'expression',
        type: 'string',
        description: 'Mathematical expression to evaluate (supports +, -, *, /, ^, sqrt, sin, cos, tan, log, ln, abs, etc.)',
        required: true
      },
      {
        name: 'precision',
        type: 'number',
        description: 'Number of decimal places for the result',
        required: false,
        default: 6
      }
    ]
  };

  async execute(parameters: Record<string, any>, context: ToolContext): Promise<ToolResult> {
    const { expression, precision = 6 } = parameters;

    try {
      // Clean and validate the expression
      const cleanExpression = this.sanitizeExpression(expression);

      if (!this.isValidExpression(cleanExpression)) {
        return {
          success: false,
          error: 'Invalid mathematical expression',
          timestamp: Date.now()
        };
      }

      // Evaluate the expression
      const result = this.evaluateExpression(cleanExpression);

      if (!isFinite(result)) {
        return {
          success: false,
          error: 'Result is not a finite number (division by zero, overflow, etc.)',
          timestamp: Date.now()
        };
      }

      const roundedResult = Number(result.toFixed(precision));

      return {
        success: true,
        data: {
          expression: expression,
          result: roundedResult,
          precision: precision,
          formatted: this.formatNumber(roundedResult)
        },
        source: 'Calculator',
        timestamp: Date.now()
      };
    } catch (error) {
      return {
        success: false,
        error: `Calculation error: ${error instanceof Error ? error.message : 'Invalid expression'}`,
        timestamp: Date.now()
      };
    }
  }

  private sanitizeExpression(expr: string): string {
    // Remove whitespace and convert common symbols
    let clean = expr.replace(/\s+/g, '');

    // Replace common mathematical symbols and functions
    clean = clean.replace(/×/g, '*');
    clean = clean.replace(/÷/g, '/');
    clean = clean.replace(/\^/g, '**');
    clean = clean.replace(/π/g, Math.PI.toString());
    clean = clean.replace(/e(?![0-9])/g, Math.E.toString());

    // Replace function names
    clean = clean.replace(/sqrt\(/g, 'Math.sqrt(');
    clean = clean.replace(/sin\(/g, 'Math.sin(');
    clean = clean.replace(/cos\(/g, 'Math.cos(');
    clean = clean.replace(/tan\(/g, 'Math.tan(');
    clean = clean.replace(/log\(/g, 'Math.log10(');
    clean = clean.replace(/ln\(/g, 'Math.log(');
    clean = clean.replace(/abs\(/g, 'Math.abs(');
    clean = clean.replace(/ceil\(/g, 'Math.ceil(');
    clean = clean.replace(/floor\(/g, 'Math.floor(');
    clean = clean.replace(/round\(/g, 'Math.round(');
    clean = clean.replace(/max\(/g, 'Math.max(');
    clean = clean.replace(/min\(/g, 'Math.min(');

    return clean;
  }

  private isValidExpression(expr: string): boolean {
    // Check for dangerous patterns
    const dangerousPatterns = [
      /[a-zA-Z_$][a-zA-Z0-9_$]*\s*\(/,  // Function calls (except Math.*)
      /\bwhile\b|\bfor\b|\bif\b|\bfunction\b|\bvar\b|\blet\b|\bconst\b/,  // Keywords
      /\[|\]/,  // Array access
      /\.\w+(?!\()/,  // Property access (except function calls)
      /=|;|{|}|`|"/,  // Assignment and other dangerous chars
    ];

    // Allow Math.* function calls
    const mathSafeExpr = expr.replace(/Math\.\w+/g, '');

    for (const pattern of dangerousPatterns) {
      if (pattern.test(mathSafeExpr)) {
        return false;
      }
    }

    // Check for balanced parentheses
    let depth = 0;
    for (const char of expr) {
      if (char === '(') depth++;
      if (char === ')') depth--;
      if (depth < 0) return false;
    }

    return depth === 0;
  }

  private evaluateExpression(expr: string): number {
    // Use Function constructor for safe evaluation
    // This is safer than eval() as we've already sanitized the input
    try {
      const func = new Function('return ' + expr);
      return func();
    } catch (error) {
      throw new Error('Invalid mathematical expression');
    }
  }

  private formatNumber(num: number): string {
    if (Math.abs(num) >= 1e6 || (Math.abs(num) <= 1e-4 && num !== 0)) {
      return num.toExponential(6);
    }
    return num.toString();
  }
}