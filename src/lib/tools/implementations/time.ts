// Time and timezone tool implementation

import { BaseTool, ToolDefinition, ToolResult, ToolContext } from '../types';

export class TimeTool extends BaseTool {
  definition: ToolDefinition = {
    name: 'get_time',
    description: 'Get current time in a specific timezone or location',
    category: 'utility',
    parameters: [
      {
        name: 'timezone',
        type: 'string',
        description: 'Timezone (e.g., "America/New_York", "Europe/London", "UTC") or city name',
        required: false,
        default: 'UTC'
      },
      {
        name: 'format',
        type: 'string',
        description: 'Time format preference',
        required: false,
        default: '24h',
        enum: ['12h', '24h', 'iso', 'unix']
      }
    ]
  };

  async execute(parameters: Record<string, any>, context: ToolContext): Promise<ToolResult> {
    const { timezone = 'UTC', format = '24h' } = parameters;

    try {
      let targetTimezone = timezone;

      // If it's a city name, try to convert to timezone
      if (!timezone.includes('/') && timezone !== 'UTC') {
        targetTimezone = await this.cityToTimezone(timezone);
      }

      const now = new Date();
      let timeData: any = {
        timezone: targetTimezone,
        utc: now.toISOString()
      };

      try {
        // Get local time in the specified timezone
        const localTime = new Date(now.toLocaleString("en-US", { timeZone: targetTimezone }));

        switch (format) {
          case '12h':
            timeData.time = localTime.toLocaleString('en-US', {
              timeZone: targetTimezone,
              hour12: true,
              weekday: 'long',
              year: 'numeric',
              month: 'long',
              day: 'numeric',
              hour: '2-digit',
              minute: '2-digit',
              second: '2-digit'
            });
            break;
          case '24h':
            timeData.time = localTime.toLocaleString('en-US', {
              timeZone: targetTimezone,
              hour12: false,
              weekday: 'long',
              year: 'numeric',
              month: 'long',
              day: 'numeric',
              hour: '2-digit',
              minute: '2-digit',
              second: '2-digit'
            });
            break;
          case 'iso':
            timeData.time = now.toISOString();
            break;
          case 'unix':
            timeData.time = Math.floor(now.getTime() / 1000);
            break;
        }

        // Add additional details
        timeData.date = localTime.toLocaleDateString('en-US', { timeZone: targetTimezone });
        timeData.dayOfWeek = localTime.toLocaleDateString('en-US', { timeZone: targetTimezone, weekday: 'long' });
        timeData.unixTimestamp = Math.floor(now.getTime() / 1000);

      } catch (timezoneError) {
        return {
          success: false,
          error: `Invalid timezone: ${targetTimezone}`,
          timestamp: Date.now()
        };
      }

      return {
        success: true,
        data: timeData,
        source: 'System Clock',
        timestamp: Date.now()
      };
    } catch (error) {
      return {
        success: false,
        error: `Failed to get time: ${error instanceof Error ? error.message : 'Unknown error'}`,
        timestamp: Date.now()
      };
    }
  }

  private async cityToTimezone(city: string): Promise<string> {
    // Simple city to timezone mapping for common cities
    const cityTimezones: Record<string, string> = {
      'new york': 'America/New_York',
      'london': 'Europe/London',
      'paris': 'Europe/Paris',
      'tokyo': 'Asia/Tokyo',
      'sydney': 'Australia/Sydney',
      'los angeles': 'America/Los_Angeles',
      'chicago': 'America/Chicago',
      'toronto': 'America/Toronto',
      'berlin': 'Europe/Berlin',
      'mumbai': 'Asia/Kolkata',
      'dubai': 'Asia/Dubai',
      'singapore': 'Asia/Singapore',
      'hong kong': 'Asia/Hong_Kong',
      'moscow': 'Europe/Moscow',
      'cairo': 'Africa/Cairo',
      'sao paulo': 'America/Sao_Paulo',
      'mexico city': 'America/Mexico_City',
      'vancouver': 'America/Vancouver',
      'zurich': 'Europe/Zurich',
      'stockholm': 'Europe/Stockholm'
    };

    const normalizedCity = city.toLowerCase().trim();
    return cityTimezones[normalizedCity] || city; // Return original if not found
  }
}