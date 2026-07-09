import { calculateSolarOutput } from './SolarSimulator.js';
import { calculateLoadOutput } from './LoadSimulator.js';
import type { HouseState } from '../store/simState.js';
import type { FlexibleAsset } from './FlexibleAssetSimulator.js';

export interface HouseTickInput {
  house: HouseState;
  irradianceWm2: number;
  hourOfDay: number;
  activeAssetPowerKw?: number[];
}

export interface HouseTickResult {
  solarKw: number;
  consumptionKw: number;
  netKw: number;
  assets: FlexibleAsset[];
}

/**
 * Calculates one tick's worth of solar, load, and net power for a house.
 * Does NOT mutate simulator state - callers are responsible for persisting
 * any asset changes via SimState.
 *
 * NOTE: Storage asset power flow (charge/discharge) is normally driven by the
 * dispatch service via MQTT actuation commands (plan section 5.3), which is
 * out of scope for this backlog. `activeAssetPowerKw` allows callers to supply
 * current power flow values when that integration exists; defaults to none.
 */
export function calculateHouseTick(input: HouseTickInput): HouseTickResult {
  const { house, irradianceWm2, hourOfDay, activeAssetPowerKw = [] } = input;

  const isGenerating = house.deviceClass !== 'consumer';

  const solarKw = isGenerating
    ? calculateSolarOutput({
        irradianceWm2,
        ratedSolarKw: house.ratedSolarKw,
        panelEfficiencyFactor: house.panelEfficiencyFactor,
      })
    : 0;

  const consumptionKw = calculateLoadOutput({
    archetype: house.loadArchetype,
    hourOfDay,
    scaleFactor: house.loadScaleFactor,
  });

  const netKw = calculateNetKw(solarKw, consumptionKw, activeAssetPowerKw);

  return {
    solarKw,
    consumptionKw,
    netKw,
    assets: house.flexibleAssets,
  };
}

/**
 * net_kw = solar_kw - consumption_kw - sum(power_kw where power_kw < 0) + sum(power_kw where power_kw > 0)
 * Exactly matches plan section 5.4.
 */
export function calculateNetKw(
  solarKw: number,
  consumptionKw: number,
  activeAssetPowerKw: number[] = []
): number {
  const dischargingSum = activeAssetPowerKw
    .filter((p) => p < 0)
    .reduce((sum, p) => sum + p, 0);

  const chargingSum = activeAssetPowerKw
    .filter((p) => p > 0)
    .reduce((sum, p) => sum + p, 0);

  return solarKw - consumptionKw - dischargingSum + chargingSum;
}