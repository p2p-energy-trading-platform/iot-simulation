import { describe, it, expect, vi, afterEach } from 'vitest';
import { getWeather } from '../src/weather/weatherProvider.js';

describe('getWeather', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('returns live data when Open-Meteo is reachable', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: () =>
          Promise.resolve({
            current: {
              shortwave_radiation: 500,
              direct_radiation: 375,
              diffuse_radiation: 125,
              cloud_cover: 10,
              temperature_2m: 30,
              time: '2026-06-29T12:00',
            },
          }),
      })
    );

    const result = await getWeather({ lat: 6.9271, lon: 79.8612 });

    expect(result.source).toBe('live');
    expect(result.shortwave_radiation).toBe(500);
  });

  it('falls back to clear-sky model when Open-Meteo is unreachable', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockRejectedValue(new Error('network down'))
    );

    const result = await getWeather({ lat: 6.9271, lon: 79.8612 });

    expect(result.source).toBe('fallback');
  });

  it('falls back when Open-Meteo returns a bad status code', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        status: 500,
        json: () => Promise.resolve({}),
      })
    );

    const result = await getWeather({ lat: 6.9271, lon: 79.8612 });

    expect(result.source).toBe('fallback');
  });

  it('falls back when Open-Meteo returns malformed data', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ current: { unexpected: 'shape' } }),
      })
    );

    const result = await getWeather({ lat: 6.9271, lon: 79.8612 });

    expect(result.source).toBe('fallback');
  });
});