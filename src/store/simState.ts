import { Database } from 'better-sqlite3';
import { stepAsset } from '../domain/FlexibleAssetSimulator.js';
import { getDatabase } from './database.js';
import { AssetType, DeviceClass, FlexibleAsset, HouseState, LoadArchetype } from '../types/config.js';
import { FlexibleAssetRow, HouseStateRow } from '../types/db.js';

export interface SimStateLogger {
  warn: (msg: string) => void;
}

const silentLogger: SimStateLogger = { warn: () => { /* no-op */ } };

export class SimState {
  private readonly db: Database;
  private readonly houses = new Map<string, HouseState>();
  private readonly dirtyHouses = new Set<string>();

  constructor() {
    this.db = getDatabase();
    this.loadIntoMemory();
  }

  private loadIntoMemory(): void {
    const rows = this.db.prepare('SELECT house_id from houses;').all() as { house_id: string }[];

    if (rows.length === 0) {
      return;
    }

    const getHouseStatement = this.db.prepare('SELECT * FROM houses WHERE house_id = ?');
    const getFlexibleAssetsStatement = this.db.prepare('SELECT * FROM flexible_assets WHERE house_id = ?');

    for (const row of rows) {
      const houseRow = getHouseStatement.get(row.house_id) as HouseStateRow;
      const assets = getFlexibleAssetsStatement.all(row.house_id) as FlexibleAssetRow[];


      const house: HouseState = {
        houseId: houseRow.house_id,
        gridId: houseRow.grid_id,
        deviceClass: houseRow.device_class as DeviceClass,
        loadArchetype: houseRow.load_archetype as LoadArchetype,
        loadScaleFactor: houseRow.load_scale_factor,
        ratedSolarKw: houseRow.rated_solar_kw,
        panelEfficiencyFactor: houseRow.panel_efficiency_factor,
        isActive: houseRow.is_active,
        flexibleAssets: assets.map(asset => ({
          assetId: asset.asset_id,
          assetType: asset.asset_type as AssetType,
          capacityKwh: asset.capacity_kwh,
          maxChargeKw: asset.max_charge_kw,
          maxDischargeKw: asset.max_discharge_kw,
          socPct: asset.soc_pct,
          targetPowerKw: asset.target_power_kw ?? undefined,
          powerKw: asset.power_kw ?? undefined,
        })),
      };

      this.houses.set(house.houseId, house);
    }

  }

  addHouse(house: HouseState): void {
    if (this.houses.has(house.houseId)) {
      throw new Error(`House "${house.houseId}" already exists in simulator state`);
    }

    const insertHouse = this.db.prepare(`
      INSERT OR IGNORE INTO houses 
      (house_id, grid_id, device_class, load_archetype, load_scale_factor, rated_solar_kw, panel_efficiency_factor, is_active)
      VALUES (@houseId, @gridId, @deviceClass, @loadArchetype, @loadScaleFactor, @ratedSolarKw, @panelEfficiencyFactor, 0)
    `);

    const insertAsset = this.db.prepare(`
      INSERT OR IGNORE INTO flexible_assets 
      (asset_id, house_id, asset_type, capacity_kwh, max_charge_kw, max_discharge_kw, soc_pct, target_power_kw, power_kw)
      VALUES (@assetId, @houseId, @assetType, @capacityKwh, @maxChargeKw, @maxDischargeKw, @socPct, @targetPowerKw, @powerKw)
    `);

    const transaction = this.db.transaction((h: HouseState) => {
      insertHouse.run(h);
      for (const asset of h.flexibleAssets) {
        insertAsset.run({
          ...asset,
          houseId: h.houseId,
          targetPowerKw: asset.targetPowerKw ?? null,
          powerKw: asset.powerKw ?? null,
        });
      }
    });

    transaction(house);

    this.houses.set(house.houseId, house);
  }

  getHouse(houseId: string): HouseState | undefined {
    return this.houses.get(houseId);
  }

  getAllHouses(): HouseState[] {
    return Array.from(this.houses.values());
  }

  getActiveHouses(): HouseState[] {
    return this.getAllHouses().filter((h) => h.isActive === 1);
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
    this.dirtyHouses.add(houseId);
  }

  /**
   * Advances every asset of a house by one tick under its current setpoint and
   * returns the updated assets.
   */
  advanceAssets(houseId: string, tickHours?: number): FlexibleAsset[] {
    const house = this.houses.get(houseId);

    if (!house) {
      throw new Error(`Cannot advance assets: house "${houseId}" not found`);
    }

    house.flexibleAssets = house.flexibleAssets.map((asset) => stepAsset(asset, tickHours));
    this.dirtyHouses.add(houseId);
    return house.flexibleAssets;
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

    // The command sets the asset's power setpoint. It takes effect from the
    // next tick and stays in force until another command replaces it, so the
    // following meter readings show the new power_kw and a moving SoC
    // (plan section 5.4, "Meter Convergence").
    this.updateAsset(houseId, { ...asset, targetPowerKw: powerKw });
  }

  get houseCount(): number {
    return this.houses.size;
  }

  activateHouse(houseId: string): void {
    const house = this.houses.get(houseId);

    if (!house) {
      return;
    }

    house.isActive = 1;
    this.db.prepare(`
      UPDATE houses
      SET is_active = 1
      WHERE house_id = ?
    `).run(houseId);
  }

  flushDirtyStates(): void {
    if (this.dirtyHouses.size === 0) {
      return;
    }

    const updateAssetStmt = this.db.prepare(`
      UPDATE flexible_assets 
      SET soc_pct = ?, target_power_kw = ?, power_kw = ? 
      WHERE asset_id = ?
    `);

    const flushTransaction = this.db.transaction((dirtyIds: string[]) => {
      for (const houseId of dirtyIds) {
        const house = this.getHouse(houseId);

        if (!house) {
          continue;
        }

        for (const asset of house.flexibleAssets) {
          updateAssetStmt.run(asset.socPct, asset.targetPowerKw, asset.powerKw, asset.assetId);
        }
      }
    });

    const idsToFlush = Array.from(this.dirtyHouses);
    flushTransaction(idsToFlush);
    this.dirtyHouses.clear();
  }
}