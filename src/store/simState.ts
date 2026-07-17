import type { FlexibleAsset } from '../domain/FlexibleAssetSimulator.js';
import { applyChargeCommand } from '../domain/FlexibleAssetSimulator.js';
import type { DeviceClass, LoadArchetype } from '../types/config.js';

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

export interface SimStateLogger {
  warn: (msg: string) => void;
}

const silentLogger: SimStateLogger = { warn: () => { /* no-op */ } };

export class SimState {
  private readonly houses = new Map<string, HouseState>();

  addHouse(house: HouseState): void {
    if (this.houses.has(house.houseId)) {
      throw new Error(`House "${house.houseId}" already exists in simulator state`);
    }
    this.houses.set(house.houseId, house);
  }

  getHouse(houseId: string): HouseState | undefined {
    return this.houses.get(houseId);
  }

  getAllHouses(): HouseState[] {
    return Array.from(this.houses.values());
  }

  getHousesByGrid(gridId: string): HouseState[] {
    return this.getAllHouses().filter((house) => house.gridId === gridId);
  }

  hasHouse(houseId: string): boolean {
    return this.houses.has(houseId);
  }

  updateAsset(houseId: string, updatedAsset: FlexibleAsset): void {
    const house = this.houses.get(houseId);

    if (!house) {
      throw new Error(`Cannot update asset: house "${houseId}" not found`);
    }

    const assetIndex = house.flexibleAssets.findIndex(
      (asset) => asset.assetId === updatedAsset.assetId
    );

    if (assetIndex === -1) {
      throw new Error(
        `Cannot update asset: asset "${updatedAsset.assetId}" not found on house "${houseId}"`
      );
    }

    house.flexibleAssets[assetIndex] = updatedAsset;
  }

  /**
   * Applies an incoming actuation command to the target house's asset.
   * Unknown house or asset IDs are logged and ignored, never thrown -
   * a bad command should never crash the simulator (plan section 5.4).
   */
  applyActuationCommand(
    houseId: string,
    assetId: string,
    powerKw: number,
    logger: SimStateLogger = silentLogger
  ): void {
    const house = this.houses.get(houseId);

    if (!house) {
      logger.warn(`Actuation command for unknown house "${houseId}" ignored`);
      return;
    }

    const asset = house.flexibleAssets.find((a) => a.assetId === assetId);

    if (!asset) {
      logger.warn(`Actuation command for unknown asset "${assetId}" on house "${houseId}" ignored`);
      return;
    }

    const updatedAsset = applyChargeCommand(asset, powerKw);
    this.updateAsset(houseId, updatedAsset);
  }

  get houseCount(): number {
    return this.houses.size;
  }
}