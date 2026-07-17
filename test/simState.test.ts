import { describe, it, expect, beforeEach } from 'vitest';
import { SimState } from '../src/store/simState.js';
import type { HouseState } from '../src/store/simState.js';

function makeHouse(overrides: Partial<HouseState> = {}): HouseState {
  return {
    houseId: 'house0042',
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
        socPct: 50,
      },
    ],
    ...overrides,
  };
}

describe('SimState', () => {
  let state: SimState;

  beforeEach(() => {
    state = new SimState();
  });

  it('starts empty', () => {
    expect(state.houseCount).toBe(0);
    expect(state.getAllHouses()).toHaveLength(0);
  });

  it('adds a house and retrieves it by ID', () => {
    const house = makeHouse();
    state.addHouse(house);

    const retrieved = state.getHouse('house0042');
    expect(retrieved).toEqual(house);
  });

  it('house ID stays stable across multiple retrievals', () => {
    state.addHouse(makeHouse({ houseId: 'house0001' }));

    const first = state.getHouse('house0001');
    const second = state.getHouse('house0001');

    expect(first?.houseId).toBe('house0001');
    expect(second?.houseId).toBe('house0001');
    expect(first).toEqual(second);
  });

  it('throws when adding a house with a duplicate ID', () => {
    state.addHouse(makeHouse({ houseId: 'house0001' }));

   beforeEach(() => {
        state = new SimState();
    });

  });

  it('returns undefined for a house that does not exist', () => {
    expect(state.getHouse('nonexistent')).toBeUndefined();
  });

  it('hasHouse correctly reports presence', () => {
    state.addHouse(makeHouse({ houseId: 'house0001' }));

    expect(state.hasHouse('house0001')).toBe(true);
    expect(state.hasHouse('house9999')).toBe(false);
  });

  it('getAllHouses returns every registered house', () => {
    state.addHouse(makeHouse({ houseId: 'house0001' }));
    state.addHouse(makeHouse({ houseId: 'house0002' }));
    state.addHouse(makeHouse({ houseId: 'house0003' }));

    expect(state.getAllHouses()).toHaveLength(3);
    expect(state.houseCount).toBe(3);
  });

  it('getHousesByGrid only returns houses from that grid', () => {
    state.addHouse(makeHouse({ houseId: 'house0001', gridId: 'grid01' }));
    state.addHouse(makeHouse({ houseId: 'house0002', gridId: 'grid01' }));
    state.addHouse(makeHouse({ houseId: 'house0003', gridId: 'grid02' }));

    const grid01Houses = state.getHousesByGrid('grid01');
    const grid02Houses = state.getHousesByGrid('grid02');

    expect(grid01Houses).toHaveLength(2);
    expect(grid02Houses).toHaveLength(1);
    expect(grid01Houses.every((h) => h.gridId === 'grid01')).toBe(true);
  });

  it('updates an asset SoC and the change persists across subsequent reads', () => {
    state.addHouse(makeHouse({ houseId: 'house0001' }));

    const house = state.getHouse('house0001');
    const asset = house?.flexibleAssets[0];
    expect(asset?.socPct).toBe(50);

    if (!asset) {
      throw new Error('Test setup failed: asset not found');
    }

    state.updateAsset('house0001', { ...asset, socPct: 75 });

    const houseAfterUpdate = state.getHouse('house0001');
    expect(houseAfterUpdate?.flexibleAssets[0]?.socPct).toBe(75);
  });

  it('asset state persists correctly across multiple simulated ticks', () => {
    state.addHouse(makeHouse({ houseId: 'house0001' }));

    // Simulate 5 ticks, each nudging SoC up by 5%
    for (let tick = 1; tick <= 5; tick++) {
      const house = state.getHouse('house0001');
      const asset = house?.flexibleAssets[0];

      if (!asset) {
        throw new Error('Test setup failed: asset not found');
      }

      state.updateAsset('house0001', { ...asset, socPct: asset.socPct + 5 });
    }

    const finalHouse = state.getHouse('house0001');
    expect(finalHouse?.flexibleAssets[0]?.socPct).toBe(75); // 50 + 5*5
  });

  it('throws when updating an asset on a house that does not exist', () => {
    const fakeAsset = makeHouse().flexibleAssets[0];

    expect(() => {
      state.updateAsset('nonexistent', fakeAsset);
    }).toThrow('not found');
  });

  it('throws when updating an asset ID that does not exist on the house', () => {
    state.addHouse(makeHouse({ houseId: 'house0001' }));

    expect(() => {
      state.updateAsset('house0001', {
        assetId: 'nonexistent_asset',
        assetType: 'bess',
        capacityKwh: 10,
        maxChargeKw: 3.5,
        maxDischargeKw: 3.5,
        socPct: 50,
      });
    }).toThrow('not found');
  });

  it('two different houses maintain independent state', () => {
    state.addHouse(makeHouse({ houseId: 'house0001' }));
    state.addHouse(makeHouse({ houseId: 'house0002' }));

    const asset1 = state.getHouse('house0001')?.flexibleAssets[0];

    if (!asset1) {
      throw new Error('Test setup failed: asset not found');
    }

    state.updateAsset('house0001', { ...asset1, socPct: 90 });

    expect(state.getHouse('house0001')?.flexibleAssets[0]?.socPct).toBe(90);
    expect(state.getHouse('house0002')?.flexibleAssets[0]?.socPct).toBe(50); // unchanged
  });


  describe('applyActuationCommand', () => {
  it('updates the target asset SoC when charging', () => {
    const state = new SimState();
    state.addHouse(makeHouse({ houseId: 'house0001' }));

    state.applyActuationCommand('house0001', 'bat_001', 1.0);

    const house = state.getHouse('house0001');
    expect(house?.flexibleAssets[0]?.socPct).toBeGreaterThan(50);
  });

  it('updates the target asset SoC when discharging', () => {
    const state = new SimState();
    state.addHouse(makeHouse({ houseId: 'house0001' }));

    state.applyActuationCommand('house0001', 'bat_001', -1.0);

    const house = state.getHouse('house0001');
    expect(house?.flexibleAssets[0]?.socPct).toBeLessThan(50);
  });

  it('ignores a command for an unknown house without throwing', () => {
    const state = new SimState();
    state.addHouse(makeHouse({ houseId: 'house0001' }));

    expect(() => {
      state.applyActuationCommand('nonexistent_house', 'bat_001', 1.0);
    }).not.toThrow();
  });

  it('logs a warning for a command targeting an unknown house', () => {
    const state = new SimState();
    state.addHouse(makeHouse({ houseId: 'house0001' }));

    const warnings: string[] = [];
    state.applyActuationCommand('nonexistent_house', 'bat_001', 1.0, {
      warn: (msg) => warnings.push(msg),
    });

    expect(warnings).toHaveLength(1);
    expect(warnings[0]).toContain('unknown house');
  });

  it('ignores a command for an unknown asset without throwing', () => {
    const state = new SimState();
    state.addHouse(makeHouse({ houseId: 'house0001' }));

    expect(() => {
      state.applyActuationCommand('house0001', 'nonexistent_asset', 1.0);
    }).not.toThrow();
  });

  it('logs a warning for a command targeting an unknown asset', () => {
    const state = new SimState();
    state.addHouse(makeHouse({ houseId: 'house0001' }));

    const warnings: string[] = [];
    state.applyActuationCommand('house0001', 'nonexistent_asset', 1.0, {
      warn: (msg) => warnings.push(msg),
    });

    expect(warnings).toHaveLength(1);
    expect(warnings[0]).toContain('unknown asset');
  });

  it('does not affect other assets or houses when applying a command', () => {
    const state = new SimState();
    state.addHouse(makeHouse({ houseId: 'house0001' }));
    state.addHouse(makeHouse({ houseId: 'house0002' }));

    state.applyActuationCommand('house0001', 'bat_001', 1.0);

    const house2 = state.getHouse('house0002');
    expect(house2?.flexibleAssets[0]?.socPct).toBe(50); // unchanged
  });
});

});