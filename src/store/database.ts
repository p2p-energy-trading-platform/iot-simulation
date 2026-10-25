import Database from "better-sqlite3";
import path from "path";

let dbInstance: Database.Database | undefined;

export function getDatabase(dbPath?: string): Database.Database {
    if (dbInstance) {
        return dbInstance;
    }

    const resolvedPath = dbPath ?? (process.env.NODE_ENV === 'test' ? ':memory:' : path.join(process.cwd(), 'sim_state.sqlite'));
    dbInstance = new Database(resolvedPath);

    dbInstance.pragma('journal_mode = WAL');
    dbInstance.pragma('synchronous = NORMAL');
    dbInstance.pragma('cache_size = -64000'); // 64 MB cache

    dbInstance.exec(`
        CREATE TABLE IF NOT EXISTS houses (
            house_id TEXT PRIMARY KEY,
            grid_id TEXT NOT NULL,
            device_class TEXT NOT NULL,
            load_archetype TEXT NOT NULL,
            load_scale_factor REAL NOT NULL,
            rated_solar_kw REAL NOT NULL,
            panel_efficiency_factor REAL NOT NULL,
            is_active INTEGER DEFAULT 0
        );

        CREATE TABLE IF NOT EXISTS flexible_assets (
            asset_id TEXT PRIMARY KEY,
            house_id TEXT NOT NULL,
            asset_type TEXT NOT NULL,
            capacity_kwh REAL NOT NULL,
            max_charge_kw REAL NOT NULL,
            max_discharge_kw REAL NOT NULL,
            soc_pct REAL NOT NULL,
            target_power_kw REAL,
            power_kw REAL,
            FOREIGN KEY (house_id) REFERENCES houses(house_id) ON DELETE CASCADE
        );

        CREATE INDEX IF NOT EXISTS idx_index_houses_active ON houses(is_active);
        CREATE INDEX IF NOT EXISTS idx_houses_grid ON houses(grid_id);
    `);

    return dbInstance;
}