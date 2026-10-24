import { describe, it, expect } from 'vitest';
import { calculateNetKw, calculateHouseTick } from '../src/domain/House.js';
import { HouseState } from '../src/types/config.js';

function makeHouse(overrides: Partial<HouseState> = {}): HouseState {
  return {
    houseId: 'house0042',
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

describe('calculateNetKw', () => {
  it('is correct with no storage assets: net = solar - consumption', () => {
    expect(calculateNetKw(3.0, 1.5, [])).toBeCloseTo(1.5, 5);
  });

  it('subtracts the discharging asset contribution (adds supply)', () => {
    // Discharging: power_kw = -2 (asset losing energy, adding to supply)
    const result = calculateNetKw(3.0, 1.5, [-2]);
    // solar - consumption - (sum of negative values) = 3 - 1.5 - (-2) = 3.5
    expect(result).toBeCloseTo(3.5, 5);
  });

  it('subtracts the charging asset contribution (adds demand)', () => {
    // Charging: power_kw = +2 (asset consuming power)
    const result = calculateNetKw(3.0, 1.5, [2]);
    // solar - consumption - charging = 3 - 1.5 - 2 = -0.5
    expect(result).toBeCloseTo(-0.5, 5);
  });

  it('handles multiple assets, mixed charging and discharging', () => {
    const result = calculateNetKw(3.0, 1.5, [-1, 2, -0.5]);
    // sum(power) = 0.5, so 3 - 1.5 - 0.5 = 1
    expect(result).toBeCloseTo(1, 5);
  });

  it('charging always lowers net and discharging always raises it', () => {
    const base = calculateNetKw(3.0, 1.5, []);
    expect(calculateNetKw(3.0, 1.5, [1])).toBeLessThan(base);
    expect(calculateNetKw(3.0, 1.5, [-1])).toBeGreaterThan(base);
  });

  it('returns a negative net when consumption exceeds solar with no assets', () => {
    expect(calculateNetKw(1.0, 3.0, [])).toBeCloseTo(-2.0, 5);
  });
});

describe('calculateHouseTick', () => {
  it('consumer houses never produce solar output', () => {
    const house = makeHouse({ deviceClass: 'consumer' });
    const result = calculateHouseTick({ house, irradianceWm2: 1000, hourOfDay: 12 });

    expect(result.solarKw).toBe(0);
  });

  it('prosumer houses produce solar output during daylight', () => {
    const house = makeHouse({ deviceClass: 'residential_prosumer' });
    const result = calculateHouseTick({ house, irradianceWm2: 1000, hourOfDay: 12 });

    expect(result.solarKw).toBeGreaterThan(0);
  });

  it('commercial houses produce solar output during daylight', () => {
    const house = makeHouse({ deviceClass: 'commercial', ratedSolarKw: 150 });
    const result = calculateHouseTick({ house, irradianceWm2: 1000, hourOfDay: 12 });

    expect(result.solarKw).toBeGreaterThan(0);
  });

  it('net_kw always equals solar - consumption when there are no active assets', () => {
    const house = makeHouse();
    const result = calculateHouseTick({ house, irradianceWm2: 800, hourOfDay: 12 });

    expect(result.netKw).toBeCloseTo(result.solarKw - result.consumptionKw, 5);
  });

  it('no solar output at night regardless of device class', () => {
    const house = makeHouse({ deviceClass: 'residential_prosumer' });
    const result = calculateHouseTick({ house, irradianceWm2: 0, hourOfDay: 2 });

    expect(result.solarKw).toBe(0);
  });
});