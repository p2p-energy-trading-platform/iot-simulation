import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { Grid } from '../src/domain/Grid.js';
import { SimState } from '../src/store/simState.js';
import type { GridConfig } from '../src/types/config.js';
import type { HouseState } from '../src/store/simState.js';

function makeGridConfig(overrides: Partial<GridConfig> = {}): GridConfig {
  return {
    grid_id: 'grid01',
    location: { lat: 6.9271, lon: 79.8612 },
    houses: 2,
    prosumer_ratio: 0.5,
    battery_ratio: 0.5,
    commercial_count: 0,
    ...overrides,
  };
}

function makeHouse(overrides: Partial<HouseState> = {}): HouseState {
  return {
    houseId: 'house0001',
    gridId: 'grid01',
    deviceClass: 'residential_prosumer',
    loadArchetype: 'family_both_work',
    loadScaleFactor: 1.0,
    ratedSolarKw: 5.0,
    panelEfficiencyFactor: 0.9,
    flexibleAssets: [],
    ...overrides,
  };
}

function mockFetchSuccess(): void {
  vi.stubGlobal(
    'fetch',
    vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: () =>
        Promise.resolve({
          current: {
            shortwave_radiation: 700,
            direct_radiation: 525,
            diffuse_radiation: 175,
            cloud_cover: 20,
            temperature_2m: 28,
            time: '2026-06-29T12:00',
          },
        }),
    })
  );
}

describe('Grid', () => {
  beforeEach(() => {
    mockFetchSuccess();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('reports the correct gridId', () => {
    const state = new SimState();
    const grid = new Grid(makeGridConfig({ grid_id: 'grid02' }), state);

    expect(grid.gridId).toBe('grid02');
  });

  it('getHouses only returns houses belonging to this grid', () => {
    const state = new SimState();
    state.addHouse(makeHouse({ houseId: 'house0001', gridId: 'grid01' }));
    state.addHouse(makeHouse({ houseId: 'house0002', gridId: 'grid01' }));
    state.addHouse(makeHouse({ houseId: 'house0003', gridId: 'grid02' }));

    const grid = new Grid(makeGridConfig({ grid_id: 'grid01' }), state);

    const houses = grid.getHouses();
    expect(houses).toHaveLength(2);
    expect(houses.every((h) => h.gridId === 'grid01')).toBe(true);
  });

  it('fetchWeather returns live weather data for this grid location', async () => {
    const state = new SimState();
    const grid = new Grid(makeGridConfig(), state);

    const weather = await grid.fetchWeather();

    expect(weather.source).toBe('live');
    expect(weather.shortwave_radiation).toBe(700);
  });

  it('fetchWeather falls back to clear-sky model when the API is unreachable', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('network down')));

    const state = new SimState();
    const grid = new Grid(makeGridConfig(), state);

    const weather = await grid.fetchWeather();

    expect(weather.source).toBe('fallback');
  });

  it('runTick produces one result per house in the grid', async () => {
    const state = new SimState();
    state.addHouse(makeHouse({ houseId: 'house0001', gridId: 'grid01' }));
    state.addHouse(makeHouse({ houseId: 'house0002', gridId: 'grid01' }));

    const grid = new Grid(makeGridConfig({ grid_id: 'grid01' }), state);

    const results = await grid.runTick(12);

    expect(results).toHaveLength(2);
  });

  it('runTick shares the same weather reading across all houses in the grid', async () => {
    const state = new SimState();
    state.addHouse(makeHouse({ houseId: 'house0001', gridId: 'grid01' }));
    state.addHouse(makeHouse({ houseId: 'house0002', gridId: 'grid01' }));

    const grid = new Grid(makeGridConfig({ grid_id: 'grid01' }), state);

    const results = await grid.runTick(12);

    const weather1 = results[0]?.weather;
    const weather2 = results[1]?.weather;

    expect(weather1).toEqual(weather2);
  });

  it('runTick only calls fetch once, not once per house', async () => {
    const fetchSpy = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: () =>
        Promise.resolve({
          current: {
            shortwave_radiation: 700,
            direct_radiation: 525,
            diffuse_radiation: 175,
            cloud_cover: 20,
            temperature_2m: 28,
            time: '2026-06-29T12:00',
          },
        }),
    });
    vi.stubGlobal('fetch', fetchSpy);

    const state = new SimState();
    state.addHouse(makeHouse({ houseId: 'house0001', gridId: 'grid01' }));
    state.addHouse(makeHouse({ houseId: 'house0002', gridId: 'grid01' }));
    state.addHouse(makeHouse({ houseId: 'house0003', gridId: 'grid01' }));

    const grid = new Grid(makeGridConfig({ grid_id: 'grid01' }), state);

    await grid.runTick(12);

    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });

  it('passes the correct irradiance from weather into each house tick calculation', async () => {
    const state = new SimState();
    state.addHouse(makeHouse({ houseId: 'house0001', gridId: 'grid01', deviceClass: 'consumer' }));

    const grid = new Grid(makeGridConfig({ grid_id: 'grid01' }), state);

    const results = await grid.runTick(12);
    const result = results[0];

    // consumer house should always have zero solar regardless of irradiance
    expect(result.tick.solarKw).toBe(0);
    expect(result.weather.shortwave_radiation).toBe(700);
  });

  it('runTick returns an empty array when the grid has no houses', async () => {
    const state = new SimState();
    const grid = new Grid(makeGridConfig({ grid_id: 'grid_empty' }), state);

    const results = await grid.runTick(12);

    expect(results).toHaveLength(0);
  });
});