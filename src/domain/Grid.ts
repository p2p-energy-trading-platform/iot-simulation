import type { GridConfig, WeatherReading } from '../types/config.js';
import type { HouseState } from '../store/simState.js';
import type { SimState } from '../store/simState.js';
import { getWeather } from '../weather/weatherProvider.js';
import { calculateHouseTick } from './House.js';

export interface GridOptions {
  /** How long one live weather reading is reused. Default 15 minutes (plan section 3). */
  weatherSyncIntervalMs?: number;
  now?: () => number;
}

export const DEFAULT_WEATHER_SYNC_INTERVAL_MS = 15 * 60 * 1000;

// While Open-Meteo is unreachable the clear-sky fallback is reused for at most a
// minute, so the live API is retried soon without being called on every tick.
const FALLBACK_REUSE_MS = 60 * 1000;

export class Grid {
  private cachedWeather: { reading: WeatherReading; fetchedAt: number } | undefined;
  private readonly weatherSyncIntervalMs: number;
  private readonly now: () => number;

  constructor(
    private readonly config: GridConfig,
    private readonly state: SimState,
    options: GridOptions = {}
  ) {
    this.weatherSyncIntervalMs = options.weatherSyncIntervalMs ?? DEFAULT_WEATHER_SYNC_INTERVAL_MS;
    this.now = options.now ?? Date.now;
  }

  get gridId(): string {
    return this.config.grid_id;
  }

  getHouses(): HouseState[] {
    return this.state.getHousesByGrid(this.config.grid_id);
  }

  /** Fetches current weather for this grid's location (live or fallback). */
  async fetchWeather(): Promise<WeatherReading> {
    return getWeather(this.config.location);
  }

  /**
   * Returns the grid's shared weather, calling Open-Meteo at most once per
   * weather sync interval instead of on every tick (plan section 3).
   */
  async currentWeather(): Promise<WeatherReading> {
    const now = this.now();
    if (this.cachedWeather) {
      const maxAge = this.cachedWeather.reading.source === 'live' ? this.weatherSyncIntervalMs : Math.min(this.weatherSyncIntervalMs, FALLBACK_REUSE_MS);
      if (now - this.cachedWeather.fetchedAt < maxAge) {
        return this.cachedWeather.reading;
      }
    }
    const reading = await this.fetchWeather();
    this.cachedWeather = { reading, fetchedAt: now };
    return reading;
  }

  /**
   * Runs one tick for every house in this grid, using a single shared weather
   * reading. Each house's storage assets are first advanced by one tick under
   * their current setpoints, so the reading reflects the power applied now.
   */
  async runTick(
    hourOfDay: number,
    tickHours?: number
  ): Promise<{ house: HouseState; weather: WeatherReading; tick: ReturnType<typeof calculateHouseTick> }[]> {
    const weather = await this.currentWeather();
    const houses = this.getHouses();

    return houses.map((house) => {
      if (house.flexibleAssets.length > 0) {
        this.state.advanceAssets(house.houseId, tickHours);
      }
      return {
        house,
        weather,
        tick: calculateHouseTick({
          house,
          irradianceWm2: weather.shortwave_radiation,
          hourOfDay,
        }),
      };
    });
  }
}