import type { GridLocation, WeatherReading } from '../types/config.js';

const OPEN_METEO_BASE_URL = 'https://api.open-meteo.com/v1/forecast';

interface OpenMeteoResponse {
  current: {
    shortwave_radiation: number;
    direct_radiation: number;
    diffuse_radiation: number;
    cloud_cover: number;
    temperature_2m: number;
    time: string;
  };
}

function isOpenMeteoResponse(data: unknown): data is OpenMeteoResponse {
  if (typeof data !== 'object' || data === null || !('current' in data)) {
    return false;
  }

  const current = (data as Record<string, unknown>).current;

  if (typeof current !== 'object' || current === null) {
    return false;
  }

  const c = current as Record<string, unknown>;

  return (
    typeof c.shortwave_radiation === 'number' &&
    typeof c.direct_radiation === 'number' &&
    typeof c.diffuse_radiation === 'number' &&
    typeof c.cloud_cover === 'number' &&
    typeof c.temperature_2m === 'number' &&
    typeof c.time === 'string'
  );
}

export async function fetchLiveWeather(location: GridLocation): Promise<WeatherReading> {
  const params = new URLSearchParams({
    latitude: String(location.lat),
    longitude: String(location.lon),
    current: 'shortwave_radiation,direct_radiation,diffuse_radiation,cloud_cover,temperature_2m',
  });

  const url = `${OPEN_METEO_BASE_URL}?${params.toString()}`;

  let response: Response;

  try {
    response = await fetch(url);
  } catch {
    throw new Error('Open-Meteo request failed: network error');
  }

  if (!response.ok) {
    throw new Error(`Open-Meteo request failed with status ${String(response.status)}`);
  }

  let data: unknown;

  try {
    data = await response.json();
  } catch {
    throw new Error('Open-Meteo response was not valid JSON');
  }

  if (!isOpenMeteoResponse(data)) {
    throw new Error('Open-Meteo response is missing expected fields');
  }

  return {
    shortwave_radiation: data.current.shortwave_radiation,
    direct_radiation: data.current.direct_radiation,
    diffuse_radiation: data.current.diffuse_radiation,
    cloud_cover: data.current.cloud_cover,
    temperature_2m: data.current.temperature_2m,
    timestamp: data.current.time,
    source: 'live',
  };
}