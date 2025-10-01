# Tool Calling Implementation

This document explains how to use the tool calling functionality that has been integrated into your local-engine project.

## Overview

The tool calling system allows your application to fetch real-time data from external APIs and services, seamlessly integrating with your existing PDF search functionality.

## Available Tools

### 1. Weather Tool (`get_weather`)
- **Description**: Get current weather information for any location
- **API**: OpenWeatherMap
- **Rate Limit**: 60 calls per minute
- **Example queries**:
  - "What's the weather in London?"
  - "Current temperature in New York"
  - "Weather forecast for Tokyo"

### 2. News Tool (`get_news`)
- **Description**: Get latest news articles on specific topics
- **API**: NewsAPI
- **Rate Limit**: 100 calls per hour
- **Example queries**:
  - "Latest news about AI"
  - "Breaking news today"
  - "Technology news"

### 3. Stock Tool (`get_stock_price`)
- **Description**: Get current stock prices and information
- **API**: Alpha Vantage
- **Rate Limit**: 5 calls per minute
- **Example queries**:
  - "AAPL stock price"
  - "Tesla share price"
  - "Google stock information"

### 4. Time Tool (`get_time`)
- **Description**: Get current time in any timezone
- **Rate Limit**: No limit (system-based)
- **Example queries**:
  - "Current time in Tokyo"
  - "What time is it in London?"
  - "Time in UTC"

### 5. Calculator Tool (`calculate`)
- **Description**: Perform mathematical calculations
- **Rate Limit**: No limit
- **Example queries**:
  - "Calculate 2 + 2"
  - "What's 15% of 200?"
  - "sqrt(144)"

## Setup Instructions

### 1. Environment Variables

Copy `.env.example` to `.env.local` and add your API keys:

```bash
cp .env.example .env.local
```

Add the following API keys to `.env.local`:

```env
# OpenWeatherMap API (free tier available)
OPENWEATHER_API_KEY=your_openweather_api_key_here

# NewsAPI (free tier available)
NEWS_API_KEY=your_news_api_key_here

# Alpha Vantage API (free tier available)
ALPHA_VANTAGE_API_KEY=your_alpha_vantage_api_key_here
```

### 2. Getting API Keys

#### OpenWeatherMap (Weather Data)
1. Visit https://openweathermap.org/api
2. Sign up for a free account
3. Generate an API key
4. Free tier: 1,000 calls/day

#### NewsAPI (News Data)
1. Visit https://newsapi.org/
2. Register for a free account
3. Get your API key
4. Free tier: 1,000 requests/day

#### Alpha Vantage (Stock Data)
1. Visit https://www.alphavantage.co/support/#api-key
2. Get a free API key
3. Free tier: 500 calls/day, 5 calls/minute

### 3. Running the Application

```bash
npm run dev
```

The tool calling functionality is automatically integrated into your search interface.

## How It Works

### Automatic Tool Detection

The system automatically detects when a query might benefit from tool calling:

1. **Query Analysis**: When you submit a search query, the system analyzes it for keywords that match available tools
2. **Confidence Scoring**: Each potential tool match gets a confidence score
3. **Execution**: Tools with confidence > 0.7 are automatically executed
4. **Result Integration**: Tool results are combined with your PDF search results

### Manual Tool Usage

You can also use the dedicated tools API:

```javascript
// List all available tools
GET /api/tools

// Execute a specific tool
POST /api/tools
{
  "action": "execute",
  "toolCall": {
    "toolName": "get_weather",
    "parameters": {
      "location": "London, UK"
    },
    "id": "unique-call-id"
  }
}
```

## User Interface Features

### Result Indicators

When viewing search results, you'll see badges indicating data sources:

- **🟢 Live Data**: Results include real-time data from external APIs
- **🔵 Documents**: Results include information from uploaded PDFs

### Combined Results

The system intelligently combines:
1. PDF search results (from your uploaded documents)
2. Tool-based real-time data
3. A unified, comprehensive answer

## Example Queries

### Weather Queries
- "What's the weather like in San Francisco?"
- "Temperature in Berlin today"
- "Is it raining in London?"

### News Queries
- "Latest technology news"
- "Breaking news today"
- "News about climate change"

### Stock Queries
- "Apple stock price"
- "How is Tesla doing today?"
- "Microsoft share price"

### Time Queries
- "What time is it in Tokyo?"
- "Current time in New York"
- "Time in GMT"

### Math Queries
- "Calculate 25 * 4"
- "What's 15% of 350?"
- "Square root of 256"

### Mixed Queries
- "What's the weather in New York and also show me tech news"
- "Tesla stock price and current time in California"

## Rate Limiting

Each tool has its own rate limits:
- Weather: 60 calls/minute
- News: 100 calls/hour
- Stocks: 5 calls/minute
- Time: No limit
- Calculator: No limit

Rate limits are automatically managed and users will see error messages if limits are exceeded.

## Error Handling

The system gracefully handles:
- API key missing or invalid
- Rate limit exceeded
- Network timeouts
- Invalid parameters
- Service unavailable

Errors don't prevent PDF search from working - the system will still show PDF results even if tools fail.

## Adding New Tools

To add a new tool:

1. Create a new class extending `BaseTool` in `src/lib/tools/implementations/`
2. Register it in `src/lib/tools/index.ts`
3. Add keyword detection in `detectToolsFromQuery()`
4. Add result formatting in the search route

## Architecture

```
src/lib/tools/
├── types.ts              # Tool interfaces and base classes
├── registry.ts           # Tool registry and execution engine
├── index.ts              # Tool initialization and utilities
├── implementations/      # Individual tool implementations
│   ├── weather.ts
│   ├── news.ts
│   ├── stocks.ts
│   ├── time.ts
│   └── calculator.ts
└── toolsClient.ts        # Client-side tool utilities

src/app/api/
├── tools/route.ts        # Tool-specific API endpoints
└── search/route.ts       # Enhanced search with tool integration
```

## Security

- All tool parameters are validated
- Dangerous expressions are filtered in calculator
- Rate limiting prevents abuse
- API keys are securely stored in environment variables
- No external code execution allowed

The tool calling system is production-ready and secure for real-world usage.