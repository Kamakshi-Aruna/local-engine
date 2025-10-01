// Weather tool implementation using OpenWeatherMap API

import { BaseTool, ToolDefinition, ToolResult, ToolContext } from '../types';

export class WeatherTool extends BaseTool {
  definition: ToolDefinition = {
    name: 'get_weather',
    description: 'Get current weather information for a specific location',
    category: 'information',
    parameters: [
      {
        name: 'location',
        type: 'string',
        description: 'City name, state/country (e.g., "London, UK" or "New York, NY")',
        required: true
      },
      {
        name: 'units',
        type: 'string',
        description: 'Temperature units',
        required: false,
        default: 'metric',
        enum: ['metric', 'imperial', 'kelvin']
      }
    ],
    rateLimit: {
      calls: 60,
      window: 60 // 60 calls per minute
    }
  };

  async execute(parameters: Record<string, any>, context: ToolContext): Promise<ToolResult> {
    const { location, units = 'metric' } = parameters;
    const apiKey = process.env.OPENWEATHER_API_KEY;

    if (!apiKey) {
      return {
        success: false,
        error: 'OpenWeatherMap API key not configured',
        timestamp: Date.now()
      };
    }

    try {
      const response = await fetch(
        `https://api.openweathermap.org/data/2.5/weather?q=${encodeURIComponent(location)}&appid=${apiKey}&units=${units}`,
        {
          method: 'GET',
          headers: {
            'User-Agent': 'LocalEngine/1.0'
          }
        }
      );

      if (!response.ok) {
        if (response.status === 404) {
          return {
            success: false,
            error: `Location "${location}" not found`,
            timestamp: Date.now()
          };
        }
        throw new Error(`Weather API error: ${response.status}`);
      }

      const data = await response.json();

      const weatherData = {
        location: `${data.name}, ${data.sys.country}`,
        temperature: Math.round(data.main.temp),
        feels_like: Math.round(data.main.feels_like),
        humidity: data.main.humidity,
        pressure: data.main.pressure,
        description: data.weather[0].description,
        wind_speed: data.wind.speed,
        wind_direction: data.wind.deg,
        visibility: data.visibility,
        units: {
          temperature: units === 'metric' ? '°C' : units === 'imperial' ? '°F' : 'K',
          wind_speed: units === 'metric' ? 'm/s' : 'mph',
          pressure: 'hPa',
          visibility: 'm'
        },
        timestamp: data.dt,
        sunrise: data.sys.sunrise,
        sunset: data.sys.sunset
      };

      return {
        success: true,
        data: weatherData,
        source: 'OpenWeatherMap',
        timestamp: Date.now()
      };
    } catch (error) {
      return {
        success: false,
        error: `Failed to fetch weather data: ${error instanceof Error ? error.message : 'Unknown error'}`,
        timestamp: Date.now()
      };
    }
  }
}