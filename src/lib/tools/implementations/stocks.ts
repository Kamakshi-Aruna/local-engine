// Stock price tool implementation using Alpha Vantage API

import { BaseTool, ToolDefinition, ToolResult, ToolContext } from '../types';

export class StockTool extends BaseTool {
  definition: ToolDefinition = {
    name: 'get_stock_price',
    description: 'Get current stock price and basic information for a company',
    category: 'finance',
    parameters: [
      {
        name: 'symbol',
        type: 'string',
        description: 'Stock symbol (e.g., "AAPL", "GOOGL", "TSLA")',
        required: true
      }
    ],
    rateLimit: {
      calls: 5,
      window: 60 // 5 calls per minute (Alpha Vantage free tier limit)
    }
  };

  async execute(parameters: Record<string, any>, context: ToolContext): Promise<ToolResult> {
    const { symbol } = parameters;
    const apiKey = process.env.ALPHA_VANTAGE_API_KEY;

    if (!apiKey) {
      return {
        success: false,
        error: 'Alpha Vantage API key not configured',
        timestamp: Date.now()
      };
    }

    try {
      // Get current quote
      const quoteResponse = await fetch(
        `https://www.alphavantage.co/query?function=GLOBAL_QUOTE&symbol=${symbol.toUpperCase()}&apikey=${apiKey}`,
        {
          method: 'GET',
          headers: {
            'User-Agent': 'LocalEngine/1.0'
          }
        }
      );

      if (!quoteResponse.ok) {
        throw new Error(`Alpha Vantage API error: ${quoteResponse.status}`);
      }

      const quoteData = await quoteResponse.json();

      // Check for API errors
      if (quoteData['Error Message']) {
        return {
          success: false,
          error: `Invalid stock symbol: ${symbol}`,
          timestamp: Date.now()
        };
      }

      if (quoteData['Note']) {
        return {
          success: false,
          error: 'API rate limit exceeded. Please try again in a minute.',
          timestamp: Date.now()
        };
      }

      const quote = quoteData['Global Quote'];
      if (!quote || Object.keys(quote).length === 0) {
        return {
          success: false,
          error: `No data available for symbol: ${symbol}`,
          timestamp: Date.now()
        };
      }

      const stockData = {
        symbol: quote['01. symbol'],
        price: parseFloat(quote['05. price']),
        change: parseFloat(quote['09. change']),
        changePercent: quote['10. change percent'],
        volume: parseInt(quote['06. volume']),
        previousClose: parseFloat(quote['08. previous close']),
        open: parseFloat(quote['02. open']),
        high: parseFloat(quote['03. high']),
        low: parseFloat(quote['04. low']),
        lastTradingDay: quote['07. latest trading day']
      };

      return {
        success: true,
        data: stockData,
        source: 'Alpha Vantage',
        timestamp: Date.now()
      };
    } catch (error) {
      return {
        success: false,
        error: `Failed to fetch stock data: ${error instanceof Error ? error.message : 'Unknown error'}`,
        timestamp: Date.now()
      };
    }
  }
}