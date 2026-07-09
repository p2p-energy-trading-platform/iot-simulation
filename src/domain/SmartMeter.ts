import type { HouseState } from '../store/simState.js';
import type { HouseTickResult } from './House.js';
import type { WeatherReading } from '../types/config.js';
import type { MeterReadingPayload, HeartbeatPayload, StorageAssetReading } from '../types/payloads.js';

const SCHEMA_VERSION = '1.0';

export function buildMeterId(gridId: string, houseId: string): string {
  return `meter-${gridId}-${houseId}`;
}

export function buildMeterReading(
  house: HouseState,
  tick: HouseTickResult,
  weather: WeatherReading,
  seq: number,
  timestamp: string = new Date().toISOString()
): MeterReadingPayload {
  const storageAssets: StorageAssetReading[] = house.flexibleAssets.map((asset) => ({
    asset_id: asset.assetId,
    asset_type: asset.assetType,
    soc_pct: asset.socPct,
    power_kw: 0, // no active dispatch command applied at this backlog stage
    capacity_kwh: asset.capacityKwh,
  }));

  return {
    schema_version: SCHEMA_VERSION,
    meter_id: buildMeterId(house.gridId, house.houseId),
    house_id: house.houseId,
    grid_id: house.gridId,
    device_class: house.deviceClass,
    timestamp,
    seq,
    readings: {
      solar_kw: tick.solarKw,
      consumption_kw: tick.consumptionKw,
      net_kw: tick.netKw,
      storage_assets: storageAssets,
    },
    meta: {
      weather_irradiance_wm2: weather.shortwave_radiation,
      cloud_cover_pct: weather.cloud_cover,
    },
  };
}

export function buildHeartbeat(house: HouseState): HeartbeatPayload {
  return {
    schema_version: SCHEMA_VERSION,
    grid_id: house.gridId,
    house_id: house.houseId,
    meter_id: buildMeterId(house.gridId, house.houseId),
    status: 'online',
    device_class: house.deviceClass,
    rated_solar_kw: house.ratedSolarKw,
    flexible_assets: house.flexibleAssets.map((asset) => ({
      asset_id: asset.assetId,
      asset_type: asset.assetType,
      capacity_kwh: asset.capacityKwh,
      max_charge_kw: asset.maxChargeKw,
      max_discharge_kw: asset.maxDischargeKw,
    })),
  };
}