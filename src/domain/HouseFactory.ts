import type { GridConfig, DeviceClass, LoadArchetype } from '../types/config.js';
import type { HouseState } from '../store/simState.js';
import type { FlexibleAsset } from './FlexibleAssetSimulator.js';

const RESIDENTIAL_LOAD_ARCHETYPES: LoadArchetype[] = [
  'apartment_single',
  'family_both_work',
  'family_home_daytime',
  'large_house',
];

const RESIDENTIAL_SOLAR_RANGE_KW: [number, number] = [2, 8];
const COMMERCIAL_SOLAR_RANGE_KW: [number, number] = [50, 300];

const RESIDENTIAL_SCALE_RANGE: [number, number] = [0.6, 1.6];
const COMMERCIAL_SCALE_RANGE: [number, number] = [3, 8];

const PANEL_EFFICIENCY_RANGE: [number, number] = [0.75, 0.95];

const BATTERY_CAPACITY_RANGE_KWH: [number, number] = [5, 15];
const BATTERY_MAX_KW_RANGE: [number, number] = [2.5, 5];

export interface RandomSource {
  next(): number; // returns [0, 1)
}

const defaultRandom: RandomSource = { next: () => Math.random() };

function randomInRange(range: [number, number], random: RandomSource): number {
  const [min, max] = range;
  return min + random.next() * (max - min);
}

function pickArchetype(random: RandomSource): LoadArchetype {
  const index = Math.floor(random.next() * RESIDENTIAL_LOAD_ARCHETYPES.length);
  const clampedIndex = Math.min(Math.max(index, 0), RESIDENTIAL_LOAD_ARCHETYPES.length - 1);
  const archetype = RESIDENTIAL_LOAD_ARCHETYPES.at(clampedIndex);
  return archetype ?? 'apartment_single';
}

function buildBatteryAsset(houseId: string, random: RandomSource): FlexibleAsset {
  const capacityKwh = randomInRange(BATTERY_CAPACITY_RANGE_KWH, random);
  const maxKw = randomInRange(BATTERY_MAX_KW_RANGE, random);

  return {
    assetId: `bat-${houseId}`,
    assetType: 'bess',
    capacityKwh,
    maxChargeKw: maxKw,
    maxDischargeKw: maxKw,
    socPct: 50, // start at half charge
  };
}


function buildHouseId(gridId: string, index: number): string {
  const padded = String(index).padStart(4, '0');
  return `${gridId}-house${padded}`;
}

interface HouseSpec {
  index: number;
  deviceClass: DeviceClass;
}

/**
 * Decides the device_class for every house in the grid based on prosumer_ratio
 * and commercial_count. Commercial houses are allocated first (fixed count),
 * then the remaining houses are split between prosumer and consumer according
 * to prosumer_ratio.
 */
function buildHouseSpecs(config: GridConfig): HouseSpec[] {
  const specs: HouseSpec[] = [];
  let index = 1;

  for (let i = 0; i < config.commercial_count; i++) {
    specs.push({ index: index++, deviceClass: 'commercial' });
  }

  const remainingHouses = config.houses - config.commercial_count;
  const prosumerCount = Math.round(remainingHouses * config.prosumer_ratio);

  for (let i = 0; i < prosumerCount; i++) {
    specs.push({ index: index++, deviceClass: 'residential_prosumer' });
  }

  const consumerCount = remainingHouses - prosumerCount;
  for (let i = 0; i < consumerCount; i++) {
    specs.push({ index: index++, deviceClass: 'consumer' });
  }

  return specs;
}

function buildHouseFromSpec(
  gridId: string,
  spec: HouseSpec,
  config: GridConfig,
  random: RandomSource
): HouseState {
  const houseId = buildHouseId(gridId, spec.index);
  const isCommercial = spec.deviceClass === 'commercial';
  const isGenerating = spec.deviceClass !== 'consumer';

  const ratedSolarKw = isGenerating
    ? randomInRange(isCommercial ? COMMERCIAL_SOLAR_RANGE_KW : RESIDENTIAL_SOLAR_RANGE_KW, random)
    : 0;

  const loadScaleFactor = randomInRange(
    isCommercial ? COMMERCIAL_SCALE_RANGE : RESIDENTIAL_SCALE_RANGE,
    random
  );

  const loadArchetype: LoadArchetype = isCommercial ? 'commercial_daytime' : pickArchetype(random);

  const panelEfficiencyFactor = isGenerating
    ? randomInRange(PANEL_EFFICIENCY_RANGE, random)
    : 0;

  const shouldHaveBattery = isGenerating && random.next() < config.battery_ratio;
  const flexibleAssets: FlexibleAsset[] = shouldHaveBattery
    ? [buildBatteryAsset(houseId, random)]
    : [];

  return {
    houseId,
    gridId,
    deviceClass: spec.deviceClass,
    loadArchetype,
    loadScaleFactor,
    ratedSolarKw,
    panelEfficiencyFactor,
    flexibleAssets,
  };
}

/**
 * Generates the full set of houses for a grid based on its config ratios.
 * House IDs are deterministic based on grid_id and creation order, so calling
 * this again with the same config produces the same house IDs (plan section 4.7).
 */
export function generateHouses(
  config: GridConfig,
  random: RandomSource = defaultRandom
): HouseState[] {
  const specs = buildHouseSpecs(config);
  return specs.map((spec) => buildHouseFromSpec(config.grid_id, spec, config, random));
}