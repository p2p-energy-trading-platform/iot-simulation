import { describe, it, expect } from 'vitest';
import { calculateSolarOutput } from '../src/domain/SolarSimulator.js';

const noNoise = (): number => 0;

describe('calculateSolarOutput', () => {
  it('returns zero when irradiance is zero (night-time)', () => {
    const result = calculateSolarOutput(
      { irradianceWm2: 0, ratedSolarKw: 5, panelEfficiencyFactor: 0.9 },
      noNoise
    );
    expect(result).toBe(0);
  });

  it('returns zero when irradiance is negative', () => {
    const result = calculateSolarOutput(
      { irradianceWm2: -50, ratedSolarKw: 5, panelEfficiencyFactor: 0.9 },
      noNoise
    );
    expect(result).toBe(0);
  });

  it('peaks at midday irradiance compared to morning/evening irradiance', () => {
    const morning = calculateSolarOutput(
      { irradianceWm2: 200, ratedSolarKw: 5, panelEfficiencyFactor: 0.9 },
      noNoise
    );
    const midday = calculateSolarOutput(
      { irradianceWm2: 1000, ratedSolarKw: 5, panelEfficiencyFactor: 0.9 },
      noNoise
    );
    const evening = calculateSolarOutput(
      { irradianceWm2: 150, ratedSolarKw: 5, panelEfficiencyFactor: 0.9 },
      noNoise
    );

    expect(midday).toBeGreaterThan(morning);
    expect(midday).toBeGreaterThan(evening);
  });

  it('correctly applies the solar formula with no noise', () => {
    // irradiance=1000, rated=5kW, efficiency=0.9 -> 1000 * (5/1000) * 0.9 = 4.5
    const result = calculateSolarOutput(
      { irradianceWm2: 1000, ratedSolarKw: 5, panelEfficiencyFactor: 0.9 },
      noNoise
    );
    expect(result).toBeCloseTo(4.5, 5);
  });

  it('two houses under the same sky produce different output due to house noise', () => {
    const sharedIrradiance = 800;

    const house1 = calculateSolarOutput(
      { irradianceWm2: sharedIrradiance, ratedSolarKw: 5, panelEfficiencyFactor: 0.9 },
      () => 0.03 // +3% noise
    );

    const house2 = calculateSolarOutput(
      { irradianceWm2: sharedIrradiance, ratedSolarKw: 5, panelEfficiencyFactor: 0.9 },
      () => -0.02 // -2% noise
    );

    expect(house1).not.toBe(house2);
  });

  it('bigger rated solar size produces more output, same conditions', () => {
    const smallHouse = calculateSolarOutput(
      { irradianceWm2: 800, ratedSolarKw: 5, panelEfficiencyFactor: 0.9 },
      noNoise
    );
    const commercial = calculateSolarOutput(
      { irradianceWm2: 800, ratedSolarKw: 150, panelEfficiencyFactor: 0.9 },
      noNoise
    );

    expect(commercial).toBeGreaterThan(smallHouse);
  });

  it('lower panel efficiency produces less output, same conditions', () => {
    const wellMaintained = calculateSolarOutput(
      { irradianceWm2: 800, ratedSolarKw: 5, panelEfficiencyFactor: 0.9 },
      noNoise
    );
    const poorlyMaintained = calculateSolarOutput(
      { irradianceWm2: 800, ratedSolarKw: 5, panelEfficiencyFactor: 0.6 },
      noNoise
    );

    expect(poorlyMaintained).toBeLessThan(wellMaintained);
  });

  it('never produces negative output even with strongly negative noise', () => {
    const result = calculateSolarOutput(
      { irradianceWm2: 100, ratedSolarKw: 5, panelEfficiencyFactor: 0.9 },
      () => -1 // -100% noise, extreme case
    );
    expect(result).toBeGreaterThanOrEqual(0);
  });

  it('uses real random noise by default within the expected range', () => {
    const base = calculateSolarOutput(
      { irradianceWm2: 1000, ratedSolarKw: 5, panelEfficiencyFactor: 0.9 },
      noNoise
    );

    for (let i = 0; i < 20; i++) {
      const noisy = calculateSolarOutput({
        irradianceWm2: 1000,
        ratedSolarKw: 5,
        panelEfficiencyFactor: 0.9,
      });

      // Should be within ±5% of the no-noise baseline
      expect(noisy).toBeGreaterThanOrEqual(base * 0.95);
      expect(noisy).toBeLessThanOrEqual(base * 1.05);
    }
  });
});