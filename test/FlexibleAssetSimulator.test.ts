import { describe, it, expect } from 'vitest';
import { applyChargeCommand, stepAsset } from '../src/domain/FlexibleAssetSimulator.js';
import type { FlexibleAsset } from '../src/domain/FlexibleAssetSimulator.js';

function makeAsset(overrides: Partial<FlexibleAsset> = {}): FlexibleAsset {
  return {
    assetId: 'bat_001',
    assetType: 'bess',
    capacityKwh: 10.0,
    maxChargeKw: 3.5,
    maxDischargeKw: 3.5,
    socPct: 50,
    ...overrides,
  };
}

describe('applyChargeCommand', () => {
  it('increases SoC when charging', () => {
    const asset = makeAsset({ socPct: 50 });
    const result = applyChargeCommand(asset, 1.0);
    expect(result.socPct).toBeGreaterThan(50);
  });

  it('decreases SoC when discharging', () => {
    const asset = makeAsset({ socPct: 50 });
    const result = applyChargeCommand(asset, -1.0);
    expect(result.socPct).toBeLessThan(50);
  });

  it('never lets SoC go below 0', () => {
    const asset = makeAsset({ socPct: 0.01, maxDischargeKw: 100 });
    const result = applyChargeCommand(asset, -100);
    expect(result.socPct).toBeGreaterThanOrEqual(0);
  });

  it('never lets SoC go above 100', () => {
    const asset = makeAsset({ socPct: 99.99, maxChargeKw: 100 });
    const result = applyChargeCommand(asset, 100);
    expect(result.socPct).toBeLessThanOrEqual(100);
  });

  it('never lets SoC go below 0 even from a full discharge request at low SoC', () => {
    const asset = makeAsset({ socPct: 1, capacityKwh: 10, maxDischargeKw: 50 });
    const result = applyChargeCommand(asset, -50);
    expect(result.socPct).toBeGreaterThanOrEqual(0);
    expect(result.socPct).toBeLessThanOrEqual(1);
  });

  it('respects max_charge_kw even if a bigger charge is requested', () => {
    const asset = makeAsset({ socPct: 10, maxChargeKw: 3.5, capacityKwh: 1000 });
    const smallCharge = applyChargeCommand(asset, 1.0);
    const cappedCharge = applyChargeCommand(asset, 999); // way above max_charge_kw

    const smallDelta = smallCharge.socPct - asset.socPct;
    const cappedDelta = cappedCharge.socPct - asset.socPct;

    // Capped charge should be proportional to max_charge_kw (3.5), not the requested 999
    expect(cappedDelta).toBeCloseTo(smallDelta * 3.5, 3);
  });

  it('respects max_discharge_kw even if a bigger discharge is requested', () => {
    const asset = makeAsset({ socPct: 90, maxDischargeKw: 3.5, capacityKwh: 1000 });
    const smallDischarge = applyChargeCommand(asset, -1.0);
    const cappedDischarge = applyChargeCommand(asset, -999);

    const smallDelta = asset.socPct - smallDischarge.socPct;
    const cappedDelta = asset.socPct - cappedDischarge.socPct;

    expect(cappedDelta).toBeCloseTo(smallDelta * 3.5, 3);
  });

  it('does nothing when requested power is zero', () => {
    const asset = makeAsset({ socPct: 50 });
    const result = applyChargeCommand(asset, 0);
    expect(result.socPct).toBe(50);
  });

  it('preserves all other asset fields unchanged', () => {
    const asset = makeAsset({ socPct: 50 });
    const result = applyChargeCommand(asset, 1.0);

    expect(result.assetId).toBe(asset.assetId);
    expect(result.assetType).toBe(asset.assetType);
    expect(result.capacityKwh).toBe(asset.capacityKwh);
    expect(result.maxChargeKw).toBe(asset.maxChargeKw);
    expect(result.maxDischargeKw).toBe(asset.maxDischargeKw);
  });

  it('works correctly for an EV asset type, not just BESS', () => {
    const evAsset = makeAsset({
      assetId: 'ev_001',
      assetType: 'ev',
      capacityKwh: 40.0,
      maxChargeKw: 7.2,
      maxDischargeKw: 3.6,
      socPct: 41,
    });

    const result = applyChargeCommand(evAsset, -1.5);
    expect(result.socPct).toBeLessThan(41);
    expect(result.assetType).toBe('ev');
  });

  it('a full charge cycle from empty stays within bounds over many ticks', () => {
    let asset = makeAsset({ socPct: 0, maxChargeKw: 3.5, capacityKwh: 10 });

    for (let i = 0; i < 10000; i++) {
      asset = applyChargeCommand(asset, 3.5); // charge at max every tick
      expect(asset.socPct).toBeGreaterThanOrEqual(0);
      expect(asset.socPct).toBeLessThanOrEqual(100);
    }

    expect(asset.socPct).toBe(100);
  });

  it('a full discharge cycle from full stays within bounds over many ticks', () => {
    let asset = makeAsset({ socPct: 100, maxDischargeKw: 3.5, capacityKwh: 10 });

    for (let i = 0; i < 10000; i++) {
      asset = applyChargeCommand(asset, -3.5); // discharge at max every tick
      expect(asset.socPct).toBeGreaterThanOrEqual(0);
      expect(asset.socPct).toBeLessThanOrEqual(100);
    }

    expect(asset.socPct).toBe(0);
  });

  it('records the applied power, clamped to the asset limits', () => {
    expect(applyChargeCommand(makeAsset(), 1.0).powerKw).toBe(1.0);
    expect(applyChargeCommand(makeAsset(), 999).powerKw).toBe(3.5);
    expect(applyChargeCommand(makeAsset(), -999).powerKw).toBe(-3.5);
  });

  it('stops charging by itself once the battery is full', () => {
    let asset = makeAsset({ socPct: 99.99, targetPowerKw: 3.5 });
    asset = stepAsset(asset);
    expect(asset.socPct).toBeCloseTo(100, 9);
    asset = stepAsset(asset);
    expect(asset.powerKw).toBe(0);
    expect(asset.socPct).toBeCloseTo(100, 9);
  });

  it('integrates SoC over the given tick length', () => {
    // 3 kW into a 10 kWh battery: 1 s adds 0.00833 %, 10 s adds ten times that.
    const oneSecond = applyChargeCommand(makeAsset(), 3, 1 / 3600);
    const tenSeconds = applyChargeCommand(makeAsset(), 3, 10 / 3600);
    expect(oneSecond.socPct - 50).toBeCloseTo((3 / 3600 / 10) * 100, 9);
    expect(tenSeconds.socPct - 50).toBeCloseTo(10 * (oneSecond.socPct - 50), 9);
  });
});
