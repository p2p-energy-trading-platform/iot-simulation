import type { LoadArchetype } from '../types/config.js';

const NOISE_RANGE = 0.1; // ±10% tick-level noise, per plan section 4.5

export interface LoadSimulatorInput {
  archetype: LoadArchetype;
  hourOfDay: number; // 0-23.99
  scaleFactor: number;
}

function generateNoise(): number {
  return (Math.random() * 2 - 1) * NOISE_RANGE;
}

/**
 * Base load shape (in kW, before scale factor) for each archetype, by hour of day.
 * These are deliberately simple curves expressing the daily pattern described
 * in plan section 4.5, not real metered data.
 */
function archetypeCurve(archetype: LoadArchetype, hour: number): number {
  switch (archetype) {
    case 'apartment_single':
      // Quiet, small peaks (small bump morning + evening)
      return 0.3 + 0.2 * gaussianBump(hour, 8, 1.5) + 0.3 * gaussianBump(hour, 19, 1.5);

    case 'family_both_work':
      // Quiet all day, sharp evening peak
      return 0.25 + 1.2 * gaussianBump(hour, 19, 1.2);

    case 'family_home_daytime':
      // Steady use all day with small bumps
      return 0.6 + 0.3 * gaussianBump(hour, 13, 3) + 0.4 * gaussianBump(hour, 19, 1.5);

    case 'large_house':
      // Higher usage throughout
      return 1.0 + 0.5 * gaussianBump(hour, 8, 1.5) + 0.7 * gaussianBump(hour, 19, 1.5);

    case 'commercial_daytime':
      // Quiet at night, busy 9-5
      return isBusinessHours(hour) ? 5.0 : 0.5;

    default: {
      const _exhaustive: never = archetype;
      throw new Error(`Unknown load archetype: ${String(_exhaustive)}`);
    }
  }
}

function isBusinessHours(hour: number): boolean {
  return hour >= 9 && hour < 17;
}

/** A simple bump centered at `center` hour, width controlled by `spread`. */
function gaussianBump(hour: number, center: number, spread: number): number {
  const distance = Math.min(
    Math.abs(hour - center),
    24 - Math.abs(hour - center) // wrap around midnight
  );
  return Math.exp(-(distance * distance) / (2 * spread * spread));
}

export function calculateLoadOutput(
  input: LoadSimulatorInput,
  noiseFn: () => number = generateNoise
): number {
  const { archetype, hourOfDay, scaleFactor } = input;

  const baseLoad = archetypeCurve(archetype, hourOfDay);
  const noise = noiseFn();

  const consumptionKw = baseLoad * scaleFactor * (1 + noise);

  return Math.max(0, consumptionKw);
}