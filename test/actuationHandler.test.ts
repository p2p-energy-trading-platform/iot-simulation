import { describe, it, expect } from 'vitest';
import { handleActuationMessage } from '../src/mqtt/actuationHandler.js';
import { SimState } from '../src/store/simState.js';
import type { HouseState } from '../src/store/simState.js';

function makeHouse(overrides: Partial<HouseState> = {}): HouseState {
  return {
    houseId: 'grid01-house0001',
    gridId: 'grid01',
    deviceClass: 'residential_prosumer',
    loadArchetype: 'family_both_work',
    loadScaleFactor: 1.0,
    ratedSolarKw: 5.0,
    panelEfficiencyFactor: 0.9,
    flexibleAssets: [
      {
        assetId: 'bat_001',
        assetType: 'bess',
        capacityKwh: 10.0,
        maxChargeKw: 3.5,
        maxDischargeKw: 3.5,
        socPct: 50,
      },
    ],
    ...overrides,
  };
}

describe('handleActuationMessage', () => {
  it('correctly updates SoC from a valid charge command', () => {
    const state = new SimState();
    state.addHouse(makeHouse());

    const payload = JSON.stringify({
      house_id: 'grid01-house0001',
      asset_id: 'bat_001',
      power_kw: 1.0,
    });

    handleActuationMessage(payload, state, { warn: () => { /* no-op */ } });

    const house = state.getHouse('grid01-house0001');
    expect(house?.flexibleAssets[0]?.socPct).toBeGreaterThan(50);
  });

  it('correctly updates SoC from a valid discharge command', () => {
    const state = new SimState();
    state.addHouse(makeHouse());

    const payload = JSON.stringify({
      house_id: 'grid01-house0001',
      asset_id: 'bat_001',
      power_kw: -1.0,
    });

    handleActuationMessage(payload, state, { warn: () => { /* no-op */ } });

    const house = state.getHouse('grid01-house0001');
    expect(house?.flexibleAssets[0]?.socPct).toBeLessThan(50);
  });

  it('does not throw and logs a warning on malformed JSON', () => {
    const state = new SimState();
    state.addHouse(makeHouse());

    const warnings: string[] = [];

    expect(() => {
      handleActuationMessage('not valid json {{{', state, {
        warn: (msg: string) => warnings.push(msg),
      });
    }).not.toThrow();

    expect(warnings.some((w) => w.includes('malformed'))).toBe(true);
  });

  it('does not throw and logs a warning when payload is missing required fields', () => {
    const state = new SimState();
    state.addHouse(makeHouse());

    const warnings: string[] = [];

    handleActuationMessage(JSON.stringify({ foo: 'bar' }), state, {
      warn: (msg: string) => warnings.push(msg),
    });

    expect(warnings.some((w) => w.includes('unexpected shape'))).toBe(true);
  });

  it('does not throw when the command targets an unknown house', () => {
    const state = new SimState();
    state.addHouse(makeHouse());

    const payload = JSON.stringify({
      house_id: 'grid99-house9999',
      asset_id: 'bat_001',
      power_kw: 1.0,
    });

    expect(() => {
      handleActuationMessage(payload, state, { warn: () => { /* no-op */ } });
    }).not.toThrow();
  });

  it('does not throw when the command targets an unknown asset', () => {
    const state = new SimState();
    state.addHouse(makeHouse());

    const payload = JSON.stringify({
      house_id: 'grid01-house0001',
      asset_id: 'nonexistent_asset',
      power_kw: 1.0,
    });

    expect(() => {
      handleActuationMessage(payload, state, { warn: () => { /* no-op */ } });
    }).not.toThrow();
  });

  it('rejects a payload where power_kw is not a number', () => {
    const state = new SimState();
    state.addHouse(makeHouse());

    const warnings: string[] = [];

    handleActuationMessage(
      JSON.stringify({ house_id: 'grid01-house0001', asset_id: 'bat_001', power_kw: 'a lot' }),
      state,
      { warn: (msg: string) => warnings.push(msg) }
    );

    expect(warnings.some((w) => w.includes('unexpected shape'))).toBe(true);
  });
});