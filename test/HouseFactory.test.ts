import { describe, it, expect } from 'vitest';
import { generateHouses } from '../src/domain/HouseFactory.js';
import type { GridConfig } from '../src/types/config.js';
import type { RandomSource } from '../src/domain/HouseFactory.js';

function makeConfig(overrides: Partial<GridConfig> = {}): GridConfig {
  return {
    grid_id: 'grid01',
    location: { lat: 6.9271, lon: 79.8612 },
    houses: 50,
    prosumer_ratio: 0.4,
    battery_ratio: 0.5,
    commercial_count: 2,
    ...overrides,
  };
}

/** Deterministic sequence generator for reproducible tests. */
function makeSeededRandom(seed = 0.5): RandomSource {
  let value = seed;
  return {
    next: (): number => {
      value = (value * 9301 + 49297) % 233280 / 233280;
      return value;
    },
  };
}

describe('generateHouses', () => {
  it('generates the correct total house count', () => {
    const config = makeConfig({ houses: 50, commercial_count: 2 });
    const houses = generateHouses(config, makeSeededRandom());

    expect(houses).toHaveLength(50);
  });

  it('generates exactly commercial_count commercial houses', () => {
    const config = makeConfig({ houses: 50, commercial_count: 2 });
    const houses = generateHouses(config, makeSeededRandom());

    const commercial = houses.filter((h) => h.deviceClass === 'commercial');
    expect(commercial).toHaveLength(2);
  });

  it('respects prosumer_ratio within a reasonable tolerance', () => {
    const config = makeConfig({ houses: 100, commercial_count: 0, prosumer_ratio: 0.4 });
    const houses = generateHouses(config, makeSeededRandom());

    const prosumers = houses.filter((h) => h.deviceClass === 'residential_prosumer');
    // Expect exactly 40 since Math.round is deterministic given remainingHouses=100
    expect(prosumers).toHaveLength(40);
  });

  it('remaining houses after commercial and prosumer are consumers', () => {
    const config = makeConfig({ houses: 50, commercial_count: 2, prosumer_ratio: 0.4 });
    const houses = generateHouses(config, makeSeededRandom());

    const consumers = houses.filter((h) => h.deviceClass === 'consumer');
    // remaining after commercial = 48, prosumer = round(48*0.4) = 19, consumer = 29
    expect(consumers).toHaveLength(29);
  });

  it('house IDs are stable and fixed when generated again with the same config', () => {
    const config = makeConfig();

    const first = generateHouses(config, makeSeededRandom(0.5));
    const second = generateHouses(config, makeSeededRandom(0.5));

    const firstIds = first.map((h) => h.houseId);
    const secondIds = second.map((h) => h.houseId);

    expect(firstIds).toEqual(secondIds);
  });

  it('house IDs follow the expected format', () => {
    const config = makeConfig({ houses: 3, commercial_count: 0, prosumer_ratio: 0 });
    const houses = generateHouses(config, makeSeededRandom());

    for (const house of houses) {
      expect(house.houseId).toMatch(/^grid01-house\d{4}$/);
    }
  });

  it('every house is correctly tagged with its grid_id', () => {
    const config = makeConfig({ grid_id: 'grid03' });
    const houses = generateHouses(config, makeSeededRandom());

    expect(houses.every((h) => h.gridId === 'grid03')).toBe(true);
  });

  it('commercial houses get commercial-sized solar output, not residential-sized', () => {
    const config = makeConfig({ houses: 10, commercial_count: 5, prosumer_ratio: 0 });
    const houses = generateHouses(config, makeSeededRandom());

    const commercial = houses.filter((h) => h.deviceClass === 'commercial');
    expect(commercial.length).toBeGreaterThan(0);

    for (const house of commercial) {
      expect(house.ratedSolarKw).toBeGreaterThanOrEqual(50);
      expect(house.ratedSolarKw).toBeLessThanOrEqual(300);
    }
  });

  it('residential prosumer houses get residential-sized solar output', () => {
    const config = makeConfig({ houses: 10, commercial_count: 0, prosumer_ratio: 1.0 });
    const houses = generateHouses(config, makeSeededRandom());

    const prosumers = houses.filter((h) => h.deviceClass === 'residential_prosumer');
    expect(prosumers.length).toBeGreaterThan(0);

    for (const house of prosumers) {
      expect(house.ratedSolarKw).toBeGreaterThanOrEqual(2);
      expect(house.ratedSolarKw).toBeLessThanOrEqual(8);
    }
  });

  it('consumer houses have zero rated solar kw', () => {
    const config = makeConfig({ houses: 5, commercial_count: 0, prosumer_ratio: 0 });
    const houses = generateHouses(config, makeSeededRandom());

    expect(houses.every((h) => h.deviceClass === 'consumer')).toBe(true);
    expect(houses.every((h) => h.ratedSolarKw === 0)).toBe(true);
  });

  it('commercial houses use the commercial_daytime load archetype', () => {
    const config = makeConfig({ houses: 5, commercial_count: 5, prosumer_ratio: 0 });
    const houses = generateHouses(config, makeSeededRandom());

    expect(houses.every((h) => h.loadArchetype === 'commercial_daytime')).toBe(true);
  });

  it('a battery_ratio of 1.0 gives every generating house a flexible asset', () => {
    const config = makeConfig({
      houses: 10,
      commercial_count: 2,
      prosumer_ratio: 1.0,
      battery_ratio: 1.0,
    });
    const houses = generateHouses(config, makeSeededRandom());

    const generatingHouses = houses.filter((h) => h.deviceClass !== 'consumer');
    expect(generatingHouses.every((h) => h.flexibleAssets.length === 1)).toBe(true);
  });

  it('a battery_ratio of 0 gives no house a flexible asset', () => {
    const config = makeConfig({
      houses: 10,
      commercial_count: 2,
      prosumer_ratio: 1.0,
      battery_ratio: 0,
    });
    const houses = generateHouses(config, makeSeededRandom());

    expect(houses.every((h) => h.flexibleAssets.length === 0)).toBe(true);
  });

  it('consumer houses never get a flexible asset even with battery_ratio of 1.0', () => {
    const config = makeConfig({
      houses: 10,
      commercial_count: 0,
      prosumer_ratio: 0,
      battery_ratio: 1.0,
    });
    const houses = generateHouses(config, makeSeededRandom());

    expect(houses.every((h) => h.deviceClass === 'consumer')).toBe(true);
    expect(houses.every((h) => h.flexibleAssets.length === 0)).toBe(true);
  });

  it('generated battery assets have valid capacity and charge/discharge ranges', () => {
    const config = makeConfig({
      houses: 5,
      commercial_count: 0,
      prosumer_ratio: 1.0,
      battery_ratio: 1.0,
    });
    const houses = generateHouses(config, makeSeededRandom());

    for (const house of houses) {
      for (const asset of house.flexibleAssets) {
        expect(asset.capacityKwh).toBeGreaterThanOrEqual(5);
        expect(asset.capacityKwh).toBeLessThanOrEqual(15);
        expect(asset.maxChargeKw).toBeGreaterThan(0);
        expect(asset.maxDischargeKw).toBeGreaterThan(0);
        expect(asset.socPct).toBe(50);
      }
    }
  });

  it('works correctly with a config that has zero commercial houses', () => {
    const config = makeConfig({ houses: 20, commercial_count: 0 });
    const houses = generateHouses(config, makeSeededRandom());

    expect(houses).toHaveLength(20);
    expect(houses.every((h) => h.deviceClass !== 'commercial')).toBe(true);
  });

  it('uses real randomness by default without needing an explicit RandomSource', () => {
    const config = makeConfig({ houses: 10 });
    const houses = generateHouses(config);

    expect(houses).toHaveLength(10);
  });
});