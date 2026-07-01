import { describe, it, expect } from 'vitest';
import { getClearSkyIrradiance, getClearSkyWeather } from '../src/weather/clearSkyFallback.js';

function atHour(hour: number, minute = 0): Date {
  const d = new Date('2026-06-29T00:00:00');
  d.setHours(hour, minute, 0, 0);
  return d;
}

describe('getClearSkyIrradiance', () => {
  it('peaks around midday', () => {
    const noon = getClearSkyIrradiance(atHour(12));
    const morning = getClearSkyIrradiance(atHour(8));
    const evening = getClearSkyIrradiance(atHour(16));

    expect(noon).toBeGreaterThan(morning);
    expect(noon).toBeGreaterThan(evening);
  });

  it('is zero before sunrise', () => {
    expect(getClearSkyIrradiance(atHour(4))).toBe(0);
  });

  it('is zero after sunset', () => {
    expect(getClearSkyIrradiance(atHour(20))).toBe(0);
  });

  it('is zero exactly at sunrise', () => {
    expect(getClearSkyIrradiance(atHour(6))).toBe(0);
  });

  it('is zero exactly at sunset', () => {
    expect(getClearSkyIrradiance(atHour(18))).toBe(0);
  });

  it('is positive during daylight hours', () => {
    expect(getClearSkyIrradiance(atHour(10))).toBeGreaterThan(0);
    expect(getClearSkyIrradiance(atHour(14))).toBeGreaterThan(0);
  });

  it('follows a smooth sine curve shape (rises then falls)', () => {
    const hours = [8, 9, 10, 11, 12, 13, 14, 15, 16];
    const readings = hours.map((h) => getClearSkyIrradiance(atHour(h)));

    const rising = readings.slice(0, 5);
    const fallingStart = readings.slice(4);

    for (let i = 0; i < rising.length - 1; i++) {
      const [a, b] = [rising[i], rising[i + 1]];
      expect(b).toBeGreaterThan(a);
    }

    for (let i = 0; i < fallingStart.length - 1; i++) {
      const [a, b] = [fallingStart[i], fallingStart[i + 1]];
      expect(b).toBeLessThan(a);
    }
  });

  it('never exceeds the peak irradiance constant', () => {
    for (let h = 6; h <= 18; h += 0.5) {
      expect(getClearSkyIrradiance(atHour(Math.floor(h), (h % 1) * 60))).toBeLessThanOrEqual(1000);
    }
  });
});

describe('getClearSkyWeather', () => {
  it('marks the reading as fallback source', () => {
    const reading = getClearSkyWeather(atHour(12));
    expect(reading.source).toBe('fallback');
  });

  it('splits irradiance into direct and diffuse components', () => {
    const reading = getClearSkyWeather(atHour(12));
    expect(reading.direct_radiation + reading.diffuse_radiation).toBeCloseTo(
      reading.shortwave_radiation,
      5
    );
  });

  it('returns zero irradiance at night', () => {
    const reading = getClearSkyWeather(atHour(2));
    expect(reading.shortwave_radiation).toBe(0);
  });
});