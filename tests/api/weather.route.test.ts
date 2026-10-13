import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const apiLimiterMock = vi.fn();
const googleGetWeatherMock = vi.fn();
const openMeteoGetWeatherMock = vi.fn();

vi.mock('@/lib/services/rateLimitService', () => ({
  apiLimiter: (...args: unknown[]) => apiLimiterMock(...args),
}));

vi.mock('@/lib/security/ip', () => ({
  getClientIP: () => '127.0.0.1',
}));

vi.mock('@/lib/logger', () => ({
  logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn(), debug: vi.fn() },
}));

vi.mock('@/lib/weather/providers/googleWeatherProvider', () => ({
  GoogleWeatherProvider: class {
    getWeather = (...args: unknown[]) => googleGetWeatherMock(...args);
  },
}));

vi.mock('@/lib/weather/providers/openMeteoProvider', () => ({
  OpenMeteoProvider: class {
    getWeather = (...args: unknown[]) => openMeteoGetWeatherMock(...args);
  },
}));

function weather(source: string) {
  return {
    current: {
      temperature: 20,
      apparentTemperature: 19,
      precipitationProbability: 10,
      windSpeed: 5,
      weatherCode: 1,
      isDay: true,
      condition: 'Clear',
    },
    timezone: 'Australia/Sydney',
    source,
    timestamp: Date.now(),
  };
}

// Unique coordinates per test avoid the route's module-level cache.
function request(lat: number) {
  return new NextRequest(`http://localhost/api/weather?lat=${lat}&lon=151.1`);
}

describe('GET /api/weather', () => {
  const originalKey = process.env.GOOGLE_WEATHER_API_KEY;

  beforeEach(() => {
    vi.resetModules();
    apiLimiterMock.mockResolvedValue({ allowed: true, resetIn: 60 });
    googleGetWeatherMock.mockReset();
    openMeteoGetWeatherMock.mockReset();
  });

  afterEach(() => {
    if (originalKey === undefined) delete process.env.GOOGLE_WEATHER_API_KEY;
    else process.env.GOOGLE_WEATHER_API_KEY = originalKey;
  });

  it('uses Google when its key is configured', async () => {
    process.env.GOOGLE_WEATHER_API_KEY = 'test-key';
    googleGetWeatherMock.mockResolvedValue(weather('google'));
    const { GET } = await import('@/app/api/weather/route');

    const res = await GET(request(-33.1));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.data.source).toBe('google');
    expect(openMeteoGetWeatherMock).not.toHaveBeenCalled();
  });

  it('falls back to Open-Meteo when the Google key is missing', async () => {
    delete process.env.GOOGLE_WEATHER_API_KEY;
    openMeteoGetWeatherMock.mockResolvedValue(weather('open-meteo'));
    const { GET } = await import('@/app/api/weather/route');

    const res = await GET(request(-33.2));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.data.source).toBe('open-meteo');
    expect(googleGetWeatherMock).not.toHaveBeenCalled();
  });

  it('falls back to Open-Meteo when Google fails', async () => {
    process.env.GOOGLE_WEATHER_API_KEY = 'test-key';
    googleGetWeatherMock.mockRejectedValue(new Error('Google outage'));
    openMeteoGetWeatherMock.mockResolvedValue(weather('open-meteo'));
    const { GET } = await import('@/app/api/weather/route');

    const res = await GET(request(-33.3));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.data.source).toBe('open-meteo');
  });

  it('returns 503 only when every provider fails', async () => {
    process.env.GOOGLE_WEATHER_API_KEY = 'test-key';
    googleGetWeatherMock.mockRejectedValue(new Error('Google outage'));
    openMeteoGetWeatherMock.mockRejectedValue(new Error('Open-Meteo outage'));
    const { GET } = await import('@/app/api/weather/route');

    const res = await GET(request(-33.4));

    expect(res.status).toBe(503);
  });

  it('rejects out-of-range coordinates before calling any provider', async () => {
    const { GET } = await import('@/app/api/weather/route');

    const res = await GET(request(999));

    expect(res.status).toBe(400);
    expect(googleGetWeatherMock).not.toHaveBeenCalled();
    expect(openMeteoGetWeatherMock).not.toHaveBeenCalled();
  });
});
