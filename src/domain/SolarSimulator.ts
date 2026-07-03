const NOISE_RANGE = 0.05; // ±5% house-level noise, per plan section 4.6

export interface SolarSimulatorInput {
  irradianceWm2: number;
  ratedSolarKw: number;
  panelEfficiencyFactor: number;
}

function generateNoise(): number {
  // Random value between -NOISE_RANGE and +NOISE_RANGE
  return (Math.random() * 2 - 1) * NOISE_RANGE;
}

export function calculateSolarOutput(
  input: SolarSimulatorInput,
  noiseFn: () => number = generateNoise
): number {
  const { irradianceWm2, ratedSolarKw, panelEfficiencyFactor } = input;

  if (irradianceWm2 <= 0) {
    return 0;
  }

  const noise = noiseFn();

  const solarKw =
    irradianceWm2 * (ratedSolarKw / 1000) * panelEfficiencyFactor * (1 + noise);

  return Math.max(0, solarKw);
}