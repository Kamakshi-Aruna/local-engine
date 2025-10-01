// Tool registry initialization and exports

import { ToolRegistry } from './registry';
import { CalculatorTool } from './implementations/calculator';

// Initialize and configure the tool registry
export function initializeTools(): ToolRegistry {
  const registry = ToolRegistry.getInstance();

  // Register all available tools
  registry.registerTool(new CalculatorTool());

  return registry;
}

// Export types and classes for external use
export * from './types';
export * from './registry';
export { CalculatorTool } from './implementations/calculator';

// Utility functions for tool detection and suggestion
export function detectToolsFromQuery(query: string): string[] {
  const toolKeywords = {
    calculator: ['calculate', 'math', 'add', 'subtract', 'multiply', 'divide', 'equation', '+', '-', '*', '/', '=']
  };

  const queryLower = query.toLowerCase();
  const detectedTools: string[] = [];

  for (const [toolName, keywords] of Object.entries(toolKeywords)) {
    if (keywords.some(keyword => queryLower.includes(keyword))) {
      detectedTools.push(toolName);
    }
  }

  return detectedTools;
}

export function getToolSuggestions(query: string): { tool: string; confidence: number; suggested_params?: Record<string, any> }[] {
  const suggestions: { tool: string; confidence: number; suggested_params?: Record<string, any> }[] = [];
  const queryLower = query.toLowerCase();


  // Math detection - improved pattern to catch expressions and mathematical functions
  const mathMatch = queryLower.match(/calculate|compute|math|value of|what is|square root|sqrt|[\d]+[\s]*[\+\-\*/\^][\s]*[\d]+/);
  if (mathMatch) {
    // Handle square root specifically
    const sqrtMatch = query.match(/(?:square root|sqrt)\s*(?:of\s*)?([\d.]+)/i);
    if (sqrtMatch) {
      suggestions.push({
        tool: 'calculate',
        confidence: 0.95,
        suggested_params: { expression: `sqrt(${sqrtMatch[1]})` }
      });
    } else {
      // Try to extract mathematical expression - improved regex to capture full expressions
      // This pattern matches: number (operator number)* to capture chains like 100+89-7
      const exprMatch = query.match(/[\d.]+(?:[\s]*[\+\-\*/\^][\s]*[\d.]+)+/g);
      if (exprMatch) {
        suggestions.push({
          tool: 'calculate',
          confidence: 0.9,
          suggested_params: { expression: exprMatch[0].trim() }
        });
      } else {
        // Fallback: if no expression found but math keywords detected
        suggestions.push({
          tool: 'calculate',
          confidence: 0.7,
          suggested_params: {}
        });
      }
    }
  }

  return suggestions.sort((a, b) => b.confidence - a.confidence);
}