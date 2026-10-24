export interface HouseStateRow {
  house_id: string;
  grid_id: string;
  device_class: string;
  load_archetype: string;
  load_scale_factor: number;
  rated_solar_kw: number;
  panel_efficiency_factor: number;
  is_active: number;
}

export interface FlexibleAssetRow {
    asset_id: string;
    asset_type: string;
    house_id: string;
    capacity_kwh: number;
    max_charge_kw: number;
    max_discharge_kw: number;
    soc_pct: number;
    target_power_kw?: number;
    power_kw?: number;
}