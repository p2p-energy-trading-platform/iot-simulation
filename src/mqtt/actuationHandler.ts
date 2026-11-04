import { extractHouseId } from '../domain/House.js';
import type { SimState, SimStateLogger } from '../store/simState.js';
import type { ActuationCommandPayload, RegistrationActuationPayload, RegistrationActuationResponsePayload } from '../types/payloads.js';
import type { SimulatorMqttClient } from './mqttClient.js';
import { ACTUATION_RESPONSE_TOPIC } from './topics.js';

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

function isRegistrationActuationPayload(data: unknown): data is RegistrationActuationPayload {
  if (typeof data !== 'object' || data === null) {
    return false;
  }

  const d = data as Record<string, unknown>;
  return (
    typeof d.meter_id === 'string' &&
    d.action === 'ACTIVATE_METER'
  );
}

/**
 * Parses an incoming MQTT actuation command message and applies it to SimState.
 * Malformed payloads are logged and ignored, never thrown.
 */
export async function handleActuationMessage(
  rawPayload: string,
  simState: SimState,
  mqttClient: SimulatorMqttClient,
  logger: SimStateLogger
): Promise<void> {
  let parsed: unknown;

  try {
    parsed = JSON.parse(rawPayload);
  } catch {
    logger.warn(`Received malformed actuation command JSON: ${rawPayload}`);
    return;
  }

  if (isRegistrationActuationPayload(parsed)) {
    const meterId = parsed.meter_id;
    const houseId = extractHouseId(meterId);
    const success = simState.applyRegistrationActuationCommand(houseId, logger);
    const house = simState.getHouse(houseId)

    if (success && house) {
      const responsePayload: RegistrationActuationResponsePayload = {
        event_type: 'METER_REGISTERED',
        timestamp: new Date().toISOString(),
        data: {
          house_id: house.houseId,
          meter_id: meterId,
          grid_id: house.gridId,
          device_class: house.deviceClass,
          rated_solar_kw: house.ratedSolarKw,
        },
      };

      try {
        await mqttClient.publish(
          ACTUATION_RESPONSE_TOPIC,
          JSON.stringify(responsePayload),
          1
        );

        logger.warn(`Successfully activated meter ${meterId} for house ${houseId} and published METER_REGISTERED response.`);
      } catch (err) {
        logger.error(`Failed to publish METER_REGISTERED response for meter ${meterId}: ${(err as Error).message}`);
      }
    } else {
      logger.warn(`Failed to apply registration actuation command for meter: ${meterId}`);
    }

    return;
  }

  if (isActuationCommandPayload(parsed)) {
    simState.applyActuationCommand(parsed.house_id, parsed.asset_id, parsed.power_kw, logger);
    return;
  }
  
  logger.warn(`Received actuation command with unexpected shape: ${rawPayload}`);
}