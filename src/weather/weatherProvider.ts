import type { GridLocation, WeatherReading } from '../types/config.js';
import { fetchLiveWeather } from './openMeteoClient.js';
import { getClearSkyWeather } from './clearSkyFallback.js';

export async function getWeather(location: GridLocation): Promise<WeatherReading> {
  try {
    return await fetchLiveWeather(location);
  } catch {
    return getClearSkyWeather();
  }
}