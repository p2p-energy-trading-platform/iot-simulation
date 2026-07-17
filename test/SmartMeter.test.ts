import { describe, it, expect } from 'vitest';
import { buildMeterReading, buildHeartbeat, buildMeterId } from '../src/domain/SmartMeter.js';
import type { HouseState } from '../src/store/simState.js';
import type { HouseTickResult } from '../src/domain/House.js';
import type { WeatherReading } from '../src/types/config.js';

function makeHouse(overrides: Partial<HouseState> = {}): HouseState {
  return {
    houseId: 'grid01-house0042',
    gridId: 'grid01',
    deviceClass: 'residential_prosumer',
    loadArchetype: 'family_both_work',
    loadScaleFactor: 1.34,
    ratedSolarKw: 5.0,
    panelEfficiencyFactor: 0.88,
    flexibleAssets: [
      {
        assetId: 'bat_001',
        assetType: 'bess',
        capacityKwh: 10.0,
        maxChargeKw: 3.5,
        maxDischargeKw: 3.5,
        socPct: 63.5,
      },
    ],
    ...overrides,
  };
}

function makeTick(overrides: Partial<HouseTickResult> = {}): HouseTickResult {
  return {
    solarKw: 2.41,
    consumptionKw: 0.87,
    netKw: 1.54,
    assets: [],
    ...overrides,
  };
}

function makeWeather(overrides: Partial<WeatherReading> = {}): WeatherReading {
  return {
    shortwave_radiation: 612.0,
    direct_radiation: 450.0,
    diffuse_radiation: 162.0,
    cloud_cover: 18,
    temperature_2m: 29.0,
    timestamp: '2026-06-16T09:30:00Z',
    source: 'live',
    ...overrides,
  };
}

describe('buildMeterId', () => {
  it('follows the meter-{house_id} format', () => {
    expect(buildMeterId('grid01-house0042')).toBe('meter-grid01-house0042');
  });
});

describe('buildMeterReading', () => {
  it('produces the correct net_kw from the tick result', () => {
    const house = makeHouse();
    const tick = makeTick({ solarKw: 2.41, consumptionKw: 0.87, netKw: 1.54 });
    const weather = makeWeather();

    const reading = buildMeterReading(house, tick, weather, 184231);

    expect(reading.readings.net_kw).toBe(1.54);
    expect(reading.readings.solar_kw).toBe(2.41);
    expect(reading.readings.consumption_kw).toBe(0.87);
  });

  it('correctly sets identifying fields', () => {
    const house = makeHouse({ houseId: 'grid01-house0042', gridId: 'grid01' });
    const tick = makeTick();
    const weather = makeWeather();

    const reading = buildMeterReading(house, tick, weather, 1);

    expect(reading.meter_id).toBe('meter-grid01-house0042');
    expect(reading.house_id).toBe('grid01-house0042');
    expect(reading.grid_id).toBe('grid01');
    expect(reading.device_class).toBe('residential_prosumer');
    expect(reading.schema_version).toBe('1.0');
  });

  it('includes storage assets when the house has them', () => {
    const house = makeHouse();
    const tick = makeTick();
    const weather = makeWeather();

    const reading = buildMeterReading(house, tick, weather, 1);

    expect(reading.readings.storage_assets).toHaveLength(1);
    expect(reading.readings.storage_assets[0]?.asset_id).toBe('bat_001');
    expect(reading.readings.storage_assets[0]?.soc_pct).toBe(63.5);
  });

  it('storage_assets is empty when the house has no batteries', () => {
    const house = makeHouse({ flexibleAssets: [] });
    const tick = makeTick();
    const weather = makeWeather();

    const reading = buildMeterReading(house, tick, weather, 1);

    expect(reading.readings.storage_assets).toHaveLength(0);
  });

  it('meta block carries the correct weather data', () => {
    const house = makeHouse();
    const tick = makeTick();
    const weather = makeWeather({ shortwave_radiation: 612.0, cloud_cover: 18 });

    const reading = buildMeterReading(house, tick, weather, 1);

    expect(reading.meta.weather_irradiance_wm2).toBe(612.0);
    expect(reading.meta.cloud_cover_pct).toBe(18);
  });

  it('carries the provided sequence number', () => {
    const house = makeHouse();
    const tick = makeTick();
    const weather = makeWeather();

    const reading = buildMeterReading(house, tick, weather, 184231);

    expect(reading.seq).toBe(184231);
  });
});

describe('buildHeartbeat', () => {
  it('contains correct static fields', () => {
    const house = makeHouse();
    const heartbeat = buildHeartbeat(house);

    expect(heartbeat.schema_version).toBe('1.0');
    expect(heartbeat.grid_id).toBe('grid01');
    expect(heartbeat.house_id).toBe('grid01-house0042');
    expect(heartbeat.meter_id).toBe('meter-grid01-house0042');
    expect(heartbeat.status).toBe('online');
    expect(heartbeat.device_class).toBe('residential_prosumer');
    expect(heartbeat.rated_solar_kw).toBe(5.0);
  });

  it('correctly lists flexible asset capabilities', () => {
    const house = makeHouse();
    const heartbeat = buildHeartbeat(house);

    expect(heartbeat.flexible_assets).toHaveLength(1);
    expect(heartbeat.flexible_assets[0]?.asset_id).toBe('bat_001');
    expect(heartbeat.flexible_assets[0]?.capacity_kwh).toBe(10.0);
    expect(heartbeat.flexible_assets[0]?.max_charge_kw).toBe(3.5);
    expect(heartbeat.flexible_assets[0]?.max_discharge_kw).toBe(3.5);
  });

  it('flexible_assets is empty for a consumer house with no storage', () => {
    const house = makeHouse({ flexibleAssets: [] });
    const heartbeat = buildHeartbeat(house);

    expect(heartbeat.flexible_assets).toHaveLength(0);
  });

  it('status is always online', () => {
    const house = makeHouse();
    const heartbeat = buildHeartbeat(house);

    expect(heartbeat.status).toBe('online');
  });
});