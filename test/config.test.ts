import { describe, it, expect } from 'vitest';
import { loadConfig } from '../src/config/loadConfig.js';
import { writeFileSync, unlinkSync } from 'fs';
import { join } from 'path';

const TMP = join(import.meta.dirname, 'tmp_test_config.yaml');

function writeTmp(content: string): string {
  writeFileSync(TMP, content, 'utf-8');
  return TMP;
}

function cleanup(): void {
  try { unlinkSync(TMP); } catch { /* already gone */ }
}

describe('loadConfig', () => {

  // --- Happy path ---

  it('parses a valid config with multiple grids', () => {
    const path = writeTmp(`
grids:
  - grid_id: grid01
    location: { lat: 6.9271, lon: 79.8612 }
    houses: 50
    prosumer_ratio: 0.4
    battery_ratio: 0.5
    commercial_count: 2
  - grid_id: grid02
    location: { lat: 9.6615, lon: 80.0255 }
    houses: 30
    prosumer_ratio: 0.3
    battery_ratio: 0.4
    commercial_count: 1
`);
    const config = loadConfig(path);
    expect(config.grids).toHaveLength(2);
    const grid0 = config.grids[0];
    const grid1 = config.grids[1];
    expect(grid0.grid_id).toBe('grid01');
    expect(grid1.grid_id).toBe('grid02');
    cleanup();
  });

  it('correctly reads all grid fields', () => {
    const path = writeTmp(`
grids:
  - grid_id: grid01
    location: { lat: 6.9271, lon: 79.8612 }
    houses: 50
    prosumer_ratio: 0.4
    battery_ratio: 0.5
    commercial_count: 2
`);
    const config = loadConfig(path);
    const grid = config.grids[0];
    expect(grid.location.lat).toBe(6.9271);
    expect(grid.location.lon).toBe(79.8612);
    expect(grid.houses).toBe(50);
    expect(grid.prosumer_ratio).toBe(0.4);
    expect(grid.battery_ratio).toBe(0.5);
    expect(grid.commercial_count).toBe(2);
    cleanup();
  });

  // --- Fail fast: file errors ---

  it('throws if the config file does not exist', () => {
    expect(() => loadConfig('/nonexistent/path/grids.yaml')).toThrow(
      'Config file not found'
    );
  });

  it('throws if the file contains invalid YAML', () => {
    const path = writeTmp(`grids: [invalid: yaml: :`);
    expect(() => loadConfig(path)).toThrow('not valid YAML');
    cleanup();
  });

  // --- Fail fast: schema errors ---

  it('throws if top-level grids key is missing', () => {
    const path = writeTmp(`something_else: true`);
    expect(() => loadConfig(path)).toThrow('"grids"');
    cleanup();
  });

  it('throws if grids array is empty', () => {
    const path = writeTmp(`grids: []`);
    expect(() => loadConfig(path)).toThrow('non-empty');
    cleanup();
  });

  it('throws if grid_id is missing', () => {
    const path = writeTmp(`
grids:
  - location: { lat: 6.9271, lon: 79.8612 }
    houses: 50
    prosumer_ratio: 0.4
    battery_ratio: 0.5
    commercial_count: 2
`);
    expect(() => loadConfig(path)).toThrow('grid_id');
    cleanup();
  });

  it('throws if location is missing', () => {
    const path = writeTmp(`
grids:
  - grid_id: grid01
    houses: 50
    prosumer_ratio: 0.4
    battery_ratio: 0.5
    commercial_count: 2
`);
    expect(() => loadConfig(path)).toThrow('location');
    cleanup();
  });

  it('throws if houses is less than 1', () => {
    const path = writeTmp(`
grids:
  - grid_id: grid01
    location: { lat: 6.9271, lon: 79.8612 }
    houses: 0
    prosumer_ratio: 0.4
    battery_ratio: 0.5
    commercial_count: 2
`);
    expect(() => loadConfig(path)).toThrow('at least 1 house');
    cleanup();
  });

  it('throws if prosumer_ratio is out of range', () => {
    const path = writeTmp(`
grids:
  - grid_id: grid01
    location: { lat: 6.9271, lon: 79.8612 }
    houses: 50
    prosumer_ratio: 1.5
    battery_ratio: 0.5
    commercial_count: 2
`);
    expect(() => loadConfig(path)).toThrow('prosumer_ratio');
    cleanup();
  });

  it('throws if battery_ratio is out of range', () => {
    const path = writeTmp(`
grids:
  - grid_id: grid01
    location: { lat: 6.9271, lon: 79.8612 }
    houses: 50
    prosumer_ratio: 0.4
    battery_ratio: -0.1
    commercial_count: 2
`);
    expect(() => loadConfig(path)).toThrow('battery_ratio');
    cleanup();
  });

  it('throws if commercial_count is negative', () => {
    const path = writeTmp(`
grids:
  - grid_id: grid01
    location: { lat: 6.9271, lon: 79.8612 }
    houses: 50
    prosumer_ratio: 0.4
    battery_ratio: 0.5
    commercial_count: -1
`);
    expect(() => loadConfig(path)).toThrow('commercial_count');
    cleanup();
  });

  // --- Real config file ---
  it('parses all three grids from the real grids.yaml', () => {
    const configPath = join(import.meta.dirname, '../config/grids.yaml');
    const config = loadConfig(configPath);

    expect(config.grids).toHaveLength(3);

    const grid01 = config.grids[0];
    const grid02 = config.grids[1];
    const grid03 = config.grids[2];

    expect(grid01.grid_id).toBe('grid01');
    expect(grid02.grid_id).toBe('grid02');
    expect(grid03.grid_id).toBe('grid03');

    expect(grid01.houses).toBe(50);
    expect(grid02.houses).toBe(30);
    expect(grid03.houses).toBe(40);
  });
  
});