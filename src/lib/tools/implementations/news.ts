// News tool implementation using NewsAPI

import { BaseTool, ToolDefinition, ToolResult, ToolContext } from '../types';

export class NewsTool extends BaseTool {
  definition: ToolDefinition = {
    name: 'get_news',
    description: 'Get latest news articles on a specific topic or general news',
    category: 'information',
    parameters: [
      {
        name: 'query',
        type: 'string',
        description: 'Search query for news articles (optional, gets general news if not provided)',
        required: false
      },
      {
        name: 'category',
        type: 'string',
        description: 'News category',
        required: false,
        enum: ['business', 'entertainment', 'general', 'health', 'science', 'sports', 'technology']
      },
      {
        name: 'country',
        type: 'string',
        description: 'Country code for news (e.g., "us", "gb", "ca")',
        required: false,
        default: 'us'
      },
      {
        name: 'limit',
        type: 'number',
        description: 'Number of articles to return (max 20)',
        required: false,
        default: 5
      }
    ],
    rateLimit: {
      calls: 100,
      window: 3600 // 100 calls per hour
    }
  };

  async execute(parameters: Record<string, any>, context: ToolContext): Promise<ToolResult> {
    const { query, category, country = 'us', limit = 5 } = parameters;
    const apiKey = process.env.NEWS_API_KEY;

    if (!apiKey) {
      return {
        success: false,
        error: 'NewsAPI key not configured',
        timestamp: Date.now()
      };
    }

    try {
      let url: string;
      const pageSize = Math.min(limit, 20); // NewsAPI limit

      if (query) {
        // Search for specific news
        url = `https://newsapi.org/v2/everything?q=${encodeURIComponent(query)}&pageSize=${pageSize}&sortBy=publishedAt&language=en`;
      } else {
        // Get top headlines
        url = `https://newsapi.org/v2/top-headlines?country=${country}&pageSize=${pageSize}`;
        if (category) {
          url += `&category=${category}`;
        }
      }

      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'X-API-Key': apiKey,
          'User-Agent': 'LocalEngine/1.0'
        }
      });

      if (!response.ok) {
        throw new Error(`News API error: ${response.status}`);
      }

      const data = await response.json();

      if (data.status !== 'ok') {
        return {
          success: false,
          error: `News API error: ${data.message || 'Unknown error'}`,
          timestamp: Date.now()
        };
      }

      const articles = data.articles.map((article: any) => ({
        title: article.title,
        description: article.description,
        url: article.url,
        urlToImage: article.urlToImage,
        publishedAt: article.publishedAt,
        source: article.source.name,
        author: article.author
      }));

      return {
        success: true,
        data: {
          articles,
          totalResults: data.totalResults,
          query: query || `${category || 'general'} news from ${country.toUpperCase()}`
        },
        source: 'NewsAPI',
        timestamp: Date.now()
      };
    } catch (error) {
      return {
        success: false,
        error: `Failed to fetch news: ${error instanceof Error ? error.message : 'Unknown error'}`,
        timestamp: Date.now()
      };
    }
  }
}