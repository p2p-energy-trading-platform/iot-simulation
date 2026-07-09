export function buildMeterTopic(gridId: string, houseId: string): string {
  return `gridx/${gridId}/${houseId}/meter`;
}

export function buildHeartbeatTopic(gridId: string, houseId: string): string {
  return `gridx/${gridId}/${houseId}/heartbeat`;
}