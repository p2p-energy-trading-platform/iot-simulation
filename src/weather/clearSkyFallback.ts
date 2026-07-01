import type { WeatherReading } from '../types/config.js';

const SUNRISE_HOUR = 6;
const SUNSET_HOUR = 18;
const DAYLIGHT_HOURS = SUNSET_HOUR - SUNRISE_HOUR;
const PEAK_IRRADIANCE_WM2 = 1000;

function getHourOfDay(date: Date): number {
  return date.getHours() + date.getMinutes() / 60;
}

export function getClearSkyIrradiance(date: Date = new Date()): number {
  const hour = getHourOfDay(date);

  if (hour <= SUNRISE_HOUR || hour >= SUNSET_HOUR) {
    return 0;
  }

  const fractionOfDay = (hour - SUNRISE_HOUR) / DAYLIGHT_HOURS;
  const irradiance = PEAK_IRRADIANCE_WM2 * Math.sin(Math.PI * fractionOfDay);

  return Math.max(0, irradiance);
}

export function getClearSkyWeather(date: Date = new Date()): WeatherReading {
  const irradiance = getClearSkyIrradiance(date);

  return {
    shortwave_radiation: irradiance,
    direct_radiation: irradiance * 0.75,
    diffuse_radiation: irradiance * 0.25,
    cloud_cover: 0,
    temperature_2m: 28,
    timestamp: date.toISOString(),
    source: 'fallback',
  };
}