export function buildMeterTopic(gridId: string, houseId: string): string {
  return `gridx/${gridId}/${houseId}/meter`;
}

export function buildHeartbeatTopic(gridId: string, houseId: string): string {
  return `gridx/${gridId}/${houseId}/heartbeat`;
}

export const ACTUATION_COMMAND_TOPIC = 'gridx/actuation';