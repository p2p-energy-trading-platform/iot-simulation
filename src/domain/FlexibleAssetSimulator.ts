import type { AssetType } from '../types/config.js';

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

export interface ChargeCommand {
  assetId: string;
  powerKw: number; // positive = charging, negative = discharging
}

export const DEFAULT_TICK_INTERVAL_HOURS = 5 / 3600; // 5-second tick expressed in hours

/**
 * Applies a charge/discharge command to a single flexible asset for one tick,
 * updating its SoC and recording the power actually applied. Respects
 * max_charge_kw / max_discharge_kw limits and never lets SoC go below 0% or
 * above 100%.
 */
export function applyChargeCommand(
  asset: FlexibleAsset,
  requestedPowerKw: number,
  tickHours: number = DEFAULT_TICK_INTERVAL_HOURS
): FlexibleAsset {
  const clampedPowerKw = clampPower(asset, requestedPowerKw, tickHours);

  const energyDeltaKwh = clampedPowerKw * tickHours;
  const socDeltaPct = (energyDeltaKwh / asset.capacityKwh) * 100;

  let newSocPct = asset.socPct + socDeltaPct;
  newSocPct = Math.min(100, Math.max(0, newSocPct));

  return {
    ...asset,
    socPct: newSocPct,
    powerKw: clampedPowerKw,
  };
}

/**
 * Advances an asset by one tick under its current setpoint. A full battery
 * stops charging and an empty one stops discharging on their own, because the
 * applied power is clamped by the remaining capacity.
 */
export function stepAsset(
  asset: FlexibleAsset,
  tickHours: number = DEFAULT_TICK_INTERVAL_HOURS
): FlexibleAsset {
  return applyChargeCommand(asset, asset.targetPowerKw ?? 0, tickHours);
}

function clampPower(asset: FlexibleAsset, requestedPowerKw: number, tickHours: number): number {
  if (requestedPowerKw > 0) {
    // Charging: also can't charge past 100% SoC
    const maxAllowedByCapacity = capacityLimitKw(asset, 100 - asset.socPct, tickHours);
    return Math.min(requestedPowerKw, asset.maxChargeKw, maxAllowedByCapacity);
  }

  if (requestedPowerKw < 0) {
    // Discharging: also can't discharge past 0% SoC
    const maxAllowedByCapacity = capacityLimitKw(asset, asset.socPct, tickHours);
    return Math.max(requestedPowerKw, -asset.maxDischargeKw, -maxAllowedByCapacity);
  }

  return 0;
}

/** Converts a percentage of capacity into the max kW achievable within one tick. */
function capacityLimitKw(asset: FlexibleAsset, availablePct: number, tickHours: number): number {
  const availableKwh = (availablePct / 100) * asset.capacityKwh;
  return availableKwh / tickHours;
}