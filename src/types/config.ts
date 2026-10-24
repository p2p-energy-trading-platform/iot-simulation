export type DeviceClass = 'consumer' | 'residential_prosumer' | 'commercial';

export type LoadArchetype =
  | 'apartment_single'
  | 'family_both_work'
  | 'family_home_daytime'
  | 'large_house'
  | 'commercial_daytime';

export type AssetType = 'bess' | 'ev';

export interface GridLocation {
  lat: number;
  lon: number;
}

export interface GridConfig {
  grid_id: string;
  location: GridLocation;
  houses: number;
  prosumer_ratio: number;
  battery_ratio: number;
  commercial_count: number;
}

export interface SimulatorConfig {
  grids: GridConfig[];
}

export interface WeatherReading {
  shortwave_radiation: number;
  direct_radiation: number;
  diffuse_radiation: number;
  cloud_cover: number;
  temperature_2m: number;
  timestamp: string;
  source: 'live' | 'fallback';
}

export interface HouseState {
  houseId: string;
  gridId: string;
  deviceClass: DeviceClass;
  loadArchetype: LoadArchetype;
  loadScaleFactor: number;
  ratedSolarKw: number;
  panelEfficiencyFactor: number;
  flexibleAssets: FlexibleAsset[];
}

export interface FlexibleAsset {
  assetId: string;
  assetType: AssetType;
  capacityKwh: number;
  maxChargeKw: number;
  maxDischargeKw: number;
  socPct: number; // 0-100
  /**
   * Power setpoint from the last actuation command, in kW (positive = charging,
   * negative = discharging). It stays in force on every tick until a new command
   * replaces it, like a real inverter setpoint. Undefined means idle.
   */
  targetPowerKw?: number;
  /** Power actually applied during the last tick, after limits. Undefined means 0. */
  powerKw?: number;
}