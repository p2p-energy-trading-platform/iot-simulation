import type { SimState, SimStateLogger } from '../store/simState.js';
import type { ActuationCommandPayload } from '../types/payloads.js';

function isActuationCommandPayload(data: unknown): data is ActuationCommandPayload {
  if (typeof data !== 'object' || data === null) {
    return false;
  }

  const d = data as Record<string, unknown>;

  return (
    typeof d.house_id === 'string' &&
    typeof d.asset_id === 'string' &&
    typeof d.power_kw === 'number'
  );
}

/**
 * Parses an incoming MQTT actuation command message and applies it to SimState.
 * Malformed payloads are logged and ignored, never thrown.
 */
export function handleActuationMessage(
  rawPayload: string,
  simState: SimState,
  logger: SimStateLogger
): void {
  let parsed: unknown;

  try {
    parsed = JSON.parse(rawPayload);
  } catch {
    logger.warn(`Received malformed actuation command JSON: ${rawPayload}`);
    return;
  }

  if (!isActuationCommandPayload(parsed)) {
    logger.warn(`Received actuation command with unexpected shape: ${rawPayload}`);
    return;
  }

  simState.applyActuationCommand(parsed.house_id, parsed.asset_id, parsed.power_kw, logger);
}