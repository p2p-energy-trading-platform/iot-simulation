import type { FlexibleAsset } from '../domain/FlexibleAssetSimulator.js';
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

export class SimState {
  private readonly houses = new Map<string, HouseState>();

  /** Registers a new house. Throws if the house ID already exists, since IDs must be stable. */
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

  /** Updates a single flexible asset's state (e.g. after a charge/discharge tick). */
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

  get houseCount(): number {
    return this.houses.size;
  }
}