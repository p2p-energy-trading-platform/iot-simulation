import { calculateSolarOutput } from './SolarSimulator.js';
import { calculateLoadOutput } from './LoadSimulator.js';
import type { FlexibleAsset } from './FlexibleAssetSimulator.js';
import { HouseState } from './HouseFactory.js';

export interface HouseTickInput {
  house: HouseState;
  irradianceWm2: number;
  hourOfDay: number;
  /** Power applied by each storage asset this tick; defaults to the house's own assets. */
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
 * Storage power comes from the assets' applied power for this tick, which is
 * driven by MQTT actuation commands (plan section 5.3/5.4).
 */
export function calculateHouseTick(input: HouseTickInput): HouseTickResult {
  const {
    house,
    irradianceWm2,
    hourOfDay,
    activeAssetPowerKw = house.flexibleAssets.map((asset) => asset.powerKw ?? 0),
  } = input;

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
 * net_kw = solar_kw - consumption_kw - sum(power_kw)
 *
 * power_kw is positive while an asset charges and negative while it discharges,
 * so a charging battery is extra demand (net goes down) and a discharging one is
 * extra supply (net goes up). Plan section 5.4 writes the charging term with a
 * "+", which would make charging raise the export; that sign is not used here.
 */
export function calculateNetKw(
  solarKw: number,
  consumptionKw: number,
  activeAssetPowerKw: number[] = []
): number {
  const storageKw = activeAssetPowerKw.reduce((sum, p) => sum + p, 0);
  return solarKw - consumptionKw - storageKw;
}