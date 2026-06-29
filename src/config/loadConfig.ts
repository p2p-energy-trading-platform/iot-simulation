import { readFileSync } from 'fs';
import { parse } from 'yaml';
import type { SimulatorConfig, GridConfig } from '../types/config.js';

function validateGridConfig(grid: unknown, index: number): GridConfig {
  if (typeof grid !== 'object' || grid === null) {
    throw new Error(`Grid at index ${String(index)} is not a valid object`);
  }

  const g = grid as Record<string, unknown>;

  if (typeof g.grid_id !== 'string' || g.grid_id.trim() === '') {
    throw new Error(`Grid at index ${String(index)} is missing a valid grid_id`);
  }

  const gridId = g.grid_id;

  if (
    typeof g.location !== 'object' ||
    g.location === null ||
    typeof (g.location as Record<string, unknown>).lat !== 'number' ||
    typeof (g.location as Record<string, unknown>).lon !== 'number'
  ) {
    throw new Error(`Grid "${gridId}" is missing a valid location (lat/lon)`);
  }

  if (typeof g.houses !== 'number' || g.houses < 1) {
    throw new Error(`Grid "${gridId}" must have at least 1 house`);
  }

  if (
    typeof g.prosumer_ratio !== 'number' ||
    g.prosumer_ratio < 0 ||
    g.prosumer_ratio > 1
  ) {
    throw new Error(`Grid "${gridId}" prosumer_ratio must be between 0 and 1`);
  }

  if (
    typeof g.battery_ratio !== 'number' ||
    g.battery_ratio < 0 ||
    g.battery_ratio > 1
  ) {
    throw new Error(`Grid "${gridId}" battery_ratio must be between 0 and 1`);
  }

  if (typeof g.commercial_count !== 'number' || g.commercial_count < 0) {
    throw new Error(`Grid "${gridId}" commercial_count must be 0 or more`);
  }

  return g as unknown as GridConfig;
}

export function loadConfig(configPath: string): SimulatorConfig {
  let raw: string;

  try {
    raw = readFileSync(configPath, 'utf-8');
  } catch {
    throw new Error(`Config file not found at path: ${configPath}`);
  }

  let parsed: unknown;

  try {
    parsed = parse(raw);
  } catch {
    throw new Error(`Config file is not valid YAML: ${configPath}`);
  }

  if (typeof parsed !== 'object' || parsed === null || !('grids' in parsed)) {
    throw new Error(`Config file must have a top-level "grids" key`);
  }

  const root = parsed as Record<string, unknown>;

  if (!Array.isArray(root.grids) || root.grids.length === 0) {
    throw new Error(`Config "grids" must be a non-empty array`);
  }

  const grids = root.grids.map((grid, index) => validateGridConfig(grid, index));

  return { grids };
}