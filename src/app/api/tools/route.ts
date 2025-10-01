import { NextRequest, NextResponse } from "next/server";

interface ToolCall {
  id: string;
  function: {
    name: string;
    arguments: string;
  };
}

interface ToolCallRequest {
  tools: ToolCall[];
}

export async function POST(request: NextRequest) {
  try {
    const { tools }: ToolCallRequest = await request.json();

    if (!tools || !Array.isArray(tools)) {
      return NextResponse.json(
        { error: "Tools array is required" },
        { status: 400 }
      );
    }

    const results = [];

    for (const tool of tools) {
      try {
        const args = JSON.parse(tool.function.arguments);
        let result;

        switch (tool.function.name) {
          case "fetch_weather":
            result = await handleWeatherFetch(args);
            break;
          case "fetch_sports":
            result = await handleSportsData(args);
            break;
          default:
            result = { error: `Unknown tool: ${tool.function.name}` };
        }

        results.push({
          tool_call_id: tool.id,
          result: result
        });
      } catch (error) {
        results.push({
          tool_call_id: tool.id,
          result: { error: `Tool execution failed: ${error instanceof Error ? error.message : 'Unknown error'}` }
        });
      }
    }

    return NextResponse.json({
      success: true,
      results: results
    });

  } catch (error) {
    console.error("❌ Tool calling error:", error);
    return NextResponse.json(
      {
        error: "Tool calling failed",
        details: error instanceof Error ? error.message : "Unknown error"
      },
      { status: 500 }
    );
  }
}

async function
handleWeatherFetch(args: { city?: string; lat?: number; lon?: number }) {
  try {
    const apiKey = process.env.OPENWEATHER_API_KEY;
    const baseUrl = process.env.WEATHER_API_URL || "https://api.openweathermap.org/data/2.5/weather";

    if (!apiKey || apiKey === 'your_openweather_api_key_here') {
      return { error: "OpenWeather API key not configured. Real weather data unavailable." };
    }

    let url = `${baseUrl}?appid=${apiKey}&units=metric`;

    if (args.city) {
      url += `&q=${encodeURIComponent(args.city)}`;
    } else if (args.lat && args.lon) {
      url += `&lat=${args.lat}&lon=${args.lon}`;
    } else {
      url += `&q=New York`;
    }

    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Weather API error: ${response.status}`);
    }

    const data = await response.json();

    const weatherData = {
      location: data.name + (data.sys?.country ? `, ${data.sys.country}` : ''),
      temperature: Math.round(data.main.temp),
      condition: data.weather[0]?.description || 'unknown',
      humidity: data.main.humidity,
      wind_speed: Math.round(data.wind?.speed * 3.6), // Convert m/s to km/h
      timestamp: new Date().toISOString()
    };

    return {
      weather: weatherData,
      source: "openweather_api"
    };
  } catch (error) {
    return { error: `Weather fetch failed: ${error instanceof Error ? error.message : 'Unknown error'}` };
  }
}

async function handleSportsData(args: { sport?: string; team?: string }) {
  try {
    const apiKey = process.env.SPORTS_API_KEY;
    const baseUrl = process.env.SPORTS_API_URL || "https://api.the-odds-api.com/v4/sports";

    if (!apiKey || apiKey === 'your_sports_api_key_here') {
      return { error: "Sports API key not configured. Real sports data unavailable." };
    }

    // Default to NFL if no sport specified
    let sport = args.sport || 'americanfootball_nfl';
    const url = `${baseUrl}/${sport}/scores?apiKey=${apiKey}&daysFrom=3`;

    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Sports API error: ${response.status}`);
    }

    const data = await response.json();

    if (!Array.isArray(data) || data.length === 0) {
      return { error: 'No sports data available' };
    }

    const games = data.slice(0, 5).map(game => ({
      id: game.id,
      sport: game.sport_title,
      home_team: game.home_team,
      away_team: game.away_team,
      home_score: game.scores ? game.scores.find((s: any) => s.name === game.home_team)?.score : null,
      away_score: game.scores ? game.scores.find((s: any) => s.name === game.away_team)?.score : null,
      status: game.completed ? 'Final' : 'Scheduled',
      commence_time: game.commence_time
    }));

    return {
      sports: games,
      sport: sport,
      timestamp: new Date().toISOString(),
      source: "the_odds_api"
    };
  } catch (error) {
    return { error: `Sports data fetch failed: ${error instanceof Error ? error.message : 'Unknown error'}` };
  }
}