import type { AssetType } from '../types/config.js';

export interface FlexibleAsset {
  assetId: string;
  assetType: AssetType;
  capacityKwh: number;
  maxChargeKw: number;
  maxDischargeKw: number;
  socPct: number; // 0-100
}

export interface ChargeCommand {
  assetId: string;
  powerKw: number; // positive = charging, negative = discharging
}

const TICK_INTERVAL_HOURS = 5 / 3600; // 5-second tick expressed in hours

/**
 * Applies a charge/discharge command to a single flexible asset for one tick,
 * updating its SoC. Respects max_charge_kw / max_discharge_kw limits and never
 * lets SoC go below 0% or above 100%.
 */
export function applyChargeCommand(
  asset: FlexibleAsset,
  requestedPowerKw: number
): FlexibleAsset {
  const clampedPowerKw = clampPower(asset, requestedPowerKw);

  const energyDeltaKwh = clampedPowerKw * TICK_INTERVAL_HOURS;
  const socDeltaPct = (energyDeltaKwh / asset.capacityKwh) * 100;

  let newSocPct = asset.socPct + socDeltaPct;
  newSocPct = Math.min(100, Math.max(0, newSocPct));

  return {
    ...asset,
    socPct: newSocPct,
  };
}

function clampPower(asset: FlexibleAsset, requestedPowerKw: number): number {
  if (requestedPowerKw > 0) {
    // Charging: also can't charge past 100% SoC
    const maxAllowedByCapacity = capacityLimitKw(asset, 100 - asset.socPct);
    return Math.min(requestedPowerKw, asset.maxChargeKw, maxAllowedByCapacity);
  }

  if (requestedPowerKw < 0) {
    // Discharging: also can't discharge past 0% SoC
    const maxAllowedByCapacity = capacityLimitKw(asset, asset.socPct);
    return Math.max(requestedPowerKw, -asset.maxDischargeKw, -maxAllowedByCapacity);
  }

  return 0;
}

/** Converts a percentage of capacity into the max kW achievable within one tick. */
function capacityLimitKw(asset: FlexibleAsset, availablePct: number): number {
  const availableKwh = (availablePct / 100) * asset.capacityKwh;
  return availableKwh / TICK_INTERVAL_HOURS;
}