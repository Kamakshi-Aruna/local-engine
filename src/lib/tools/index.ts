// Tool registry initialization and exports

import { ToolRegistry } from './registry';
import { WeatherTool } from './implementations/weather';
import { NewsTool } from './implementations/news';
import { StockTool } from './implementations/stocks';
import { TimeTool } from './implementations/time';
import { CalculatorTool } from './implementations/calculator';

// Initialize and configure the tool registry
export function initializeTools(): ToolRegistry {
  const registry = ToolRegistry.getInstance();

  // Register all available tools
  registry.registerTool(new WeatherTool());
  registry.registerTool(new NewsTool());
  registry.registerTool(new StockTool());
  registry.registerTool(new TimeTool());
  registry.registerTool(new CalculatorTool());

  return registry;
}

// Export types and classes for external use
export * from './types';
export * from './registry';
export { WeatherTool } from './implementations/weather';
export { NewsTool } from './implementations/news';
export { StockTool } from './implementations/stocks';
export { TimeTool } from './implementations/time';
export { CalculatorTool } from './implementations/calculator';

// Utility functions for tool detection and suggestion
export function detectToolsFromQuery(query: string): string[] {
  const toolKeywords = {
    weather: ['weather', 'temperature', 'rain', 'snow', 'forecast', 'climate', 'humidity', 'wind'],
    news: ['news', 'headlines', 'breaking', 'latest', 'article', 'report', 'update'],
    stocks: ['stock', 'share', 'price', 'market', 'trading', 'nasdaq', 'nyse', 'equity'],
    time: ['time', 'clock', 'date', 'timezone', 'hour', 'minute', 'when', 'now'],
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

  // Weather detection
  if (/weather|temperature|forecast/.test(queryLower)) {
    const locationMatch = queryLower.match(/(?:in|for|at)\s+([a-z\s,]+)/i);
    suggestions.push({
      tool: 'get_weather',
      confidence: 0.9,
      suggested_params: locationMatch ? { location: locationMatch[1].trim() } : {}
    });
  }

  // News detection
  if (/news|headlines|breaking/.test(queryLower)) {
    const topicMatch = queryLower.match(/news\s+(?:about|on|regarding)\s+([a-z\s]+)/i);
    suggestions.push({
      tool: 'get_news',
      confidence: 0.8,
      suggested_params: topicMatch ? { query: topicMatch[1].trim() } : {}
    });
  }

  // Stock detection
  const stockMatch = queryLower.match(/(?:stock|share|price)\s+(?:of\s+)?([a-z]{1,5})/i);
  if (stockMatch || /nasdaq|nyse|trading/.test(queryLower)) {
    suggestions.push({
      tool: 'get_stock_price',
      confidence: stockMatch ? 0.9 : 0.7,
      suggested_params: stockMatch ? { symbol: stockMatch[1].toUpperCase() } : {}
    });
  }

  // Time detection
  if (/time|clock|timezone/.test(queryLower)) {
    const timezoneMatch = queryLower.match(/time\s+in\s+([a-z\s/]+)/i);
    suggestions.push({
      tool: 'get_time',
      confidence: 0.8,
      suggested_params: timezoneMatch ? { timezone: timezoneMatch[1].trim() } : {}
    });
  }

  // Math detection - improved pattern to catch expressions like "90+10" or "value of 90+10"
  const mathMatch = queryLower.match(/calculate|compute|math|value of|what is|[\d]+[\s]*[\+\-\*/\^][\s]*[\d]+/);
  if (mathMatch) {
    // Try to extract mathematical expression - improved regex
    const exprMatch = query.match(/[\d]+[\s]*[\+\-\*/\^().\s√π]+[\d]+/);
    suggestions.push({
      tool: 'calculate',
      confidence: 0.9,
      suggested_params: exprMatch ? { expression: exprMatch[0].trim() } : {}
    });
  }

  return suggestions.sort((a, b) => b.confidence - a.confidence);
}