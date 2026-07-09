import type { GridConfig, WeatherReading } from '../types/config.js';
import type { HouseState } from '../store/simState.js';
import type { SimState } from '../store/simState.js';
import { getWeather } from '../weather/weatherProvider.js';
import { calculateHouseTick } from './House.js';

export class Grid {
  constructor(
    private readonly config: GridConfig,
    private readonly state: SimState
  ) {}

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

  /** Runs one tick for every house in this grid, using a single shared weather reading. */
  async runTick(hourOfDay: number): Promise<{ house: HouseState; weather: WeatherReading; tick: ReturnType<typeof calculateHouseTick> }[]> {
    const weather = await this.fetchWeather();
    const houses = this.getHouses();

    return houses.map((house) => ({
      house,
      weather,
      tick: calculateHouseTick({
        house,
        irradianceWm2: weather.shortwave_radiation,
        hourOfDay,
      }),
    }));
  }
}