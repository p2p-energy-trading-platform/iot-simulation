import { describe, it, expect, vi, afterEach } from 'vitest';
import { fetchLiveWeather } from '../src/weather/openMeteoClient.js';

describe('fetchLiveWeather', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('returns correctly shaped weather data on success', async () => {
    const mockResponse = {
      current: {
        shortwave_radiation: 612.0,
        direct_radiation: 450.0,
        diffuse_radiation: 162.0,
        cloud_cover: 18,
        temperature_2m: 29.5,
        time: '2026-06-29T09:30',
      },
    };

    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.resolve(mockResponse),
      })
    );

    const result = await fetchLiveWeather({ lat: 6.9271, lon: 79.8612 });

    expect(result.shortwave_radiation).toBe(612.0);
    expect(result.direct_radiation).toBe(450.0);
    expect(result.diffuse_radiation).toBe(162.0);
    expect(result.cloud_cover).toBe(18);
    expect(result.temperature_2m).toBe(29.5);
    expect(result.source).toBe('live');
  });

  it('throws if the network request fails', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockRejectedValue(new Error('network down'))
    );

    await expect(
      fetchLiveWeather({ lat: 6.9271, lon: 79.8612 })
    ).rejects.toThrow('network error');
  });

  it('throws if the response status is not ok', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        status: 503,
        json: () => Promise.resolve({}),
      })
    );

    await expect(
      fetchLiveWeather({ lat: 6.9271, lon: 79.8612 })
    ).rejects.toThrow('status 503');
  });

  it('throws if the response body is missing expected fields', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ current: { foo: 'bar' } }),
      })
    );

    await expect(
      fetchLiveWeather({ lat: 6.9271, lon: 79.8612 })
    ).rejects.toThrow('missing expected fields');
  });

  it('throws if the response is not valid JSON', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.reject(new Error('invalid json')),
      })
    );

    await expect(
      fetchLiveWeather({ lat: 6.9271, lon: 79.8612 })
    ).rejects.toThrow('not valid JSON');
  });
});