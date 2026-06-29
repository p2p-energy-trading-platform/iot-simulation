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