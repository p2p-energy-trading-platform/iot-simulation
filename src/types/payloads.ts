import type { DeviceClass, AssetType } from './config.js';

export interface StorageAssetReading {
  asset_id: string;
  asset_type: AssetType;
  soc_pct: number;
  power_kw: number;
  capacity_kwh: number;
  plugged_in?: boolean;
}

export interface MeterReadingPayload {
  schema_version: string;
  meter_id: string;
  house_id: string;
  grid_id: string;
  device_class: DeviceClass;
  timestamp: string;
  seq: number;
  readings: {
    solar_kw: number;
    consumption_kw: number;
    net_kw: number;
    storage_assets: StorageAssetReading[];
  };
  meta: {
    weather_irradiance_wm2: number;
    cloud_cover_pct: number;
  };
}

export interface FlexibleAssetCapability {
  asset_id: string;
  asset_type: AssetType;
  capacity_kwh: number;
  max_charge_kw: number;
  max_discharge_kw: number;
  v2g_capable?: boolean;
}

export interface HeartbeatPayload {
  schema_version: string;
  grid_id: string;
  house_id: string;
  meter_id: string;
  status: 'online';
  device_class: DeviceClass;
  rated_solar_kw: number;
  flexible_assets: FlexibleAssetCapability[];
}