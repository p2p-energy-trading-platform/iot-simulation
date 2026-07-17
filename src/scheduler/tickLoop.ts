import type { Grid } from '../domain/Grid.js';
import type { SimulatorMqttClient } from '../mqtt/mqttClient.js';
import { buildMeterTopic, buildHeartbeatTopic } from '../mqtt/topics.js';
import { buildMeterReading, buildHeartbeat } from '../domain/SmartMeter.js';
import type { MqttLogger } from '../mqtt/mqttClient.js';

export interface TickLoopOptions {
  grids: Grid[];
  mqttClient: SimulatorMqttClient;
  tickIntervalMs?: number;
  heartbeatIntervalMs?: number;
  logger?: MqttLogger;
}

const DEFAULT_TICK_INTERVAL_MS = 5000;
const DEFAULT_HEARTBEAT_INTERVAL_MS = 60000;

const consoleLogger: MqttLogger = {
  /* eslint-disable no-console */
  info: (msg) => { console.log(msg); },
  warn: (msg) => { console.warn(msg); },
  error: (msg) => { console.error(msg); },
  /* eslint-enable no-console */
};

export class TickLoop {
  private readonly grids: Grid[];
  private readonly mqttClient: SimulatorMqttClient;
  private readonly tickIntervalMs: number;
  private readonly heartbeatIntervalMs: number;
  private readonly logger: MqttLogger;

  private tickTimer: NodeJS.Timeout | undefined;
  private heartbeatTimer: NodeJS.Timeout | undefined;
  private seqCounters = new Map<string, number>();

  constructor(options: TickLoopOptions) {
    this.grids = options.grids;
    this.mqttClient = options.mqttClient;
    this.tickIntervalMs = options.tickIntervalMs ?? DEFAULT_TICK_INTERVAL_MS;
    this.heartbeatIntervalMs = options.heartbeatIntervalMs ?? DEFAULT_HEARTBEAT_INTERVAL_MS;
    this.logger = options.logger ?? consoleLogger;
  }

  start(): void {
    this.tickTimer = setInterval(() => {
      void this.runAllGridTicks();
    }, this.tickIntervalMs);

    this.heartbeatTimer = setInterval(() => {
      void this.runAllGridHeartbeats();
    }, this.heartbeatIntervalMs);
  }

  stop(): void {
    if (this.tickTimer) {
      clearInterval(this.tickTimer);
      this.tickTimer = undefined;
    }
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = undefined;
    }
  }

  private nextSeq(houseId: string): number {
    const current = this.seqCounters.get(houseId) ?? 0;
    const next = current + 1;
    this.seqCounters.set(houseId, next);
    return next;
  }

  /** Runs one tick for every grid. A failure in one grid/house never blocks the others. */
  async runAllGridTicks(): Promise<void> {
    const hourOfDay = new Date().getHours() + new Date().getMinutes() / 60;

    const gridResults = await Promise.allSettled(
      this.grids.map((grid) => this.runSingleGridTick(grid, hourOfDay))
    );

    gridResults.forEach((result, index) => {
      if (result.status === 'rejected') {
        const gridId = this.grids[index]?.gridId ?? 'unknown';
        this.logger.error(`Tick failed for grid "${gridId}": ${String(result.reason)}`);
      }
    });
  }

  private async runSingleGridTick(grid: Grid, hourOfDay: number): Promise<void> {
    const tickResults = await grid.runTick(hourOfDay);

    const publishResults = await Promise.allSettled(
      tickResults.map(({ house, weather, tick }) => {
        const seq = this.nextSeq(house.houseId);
        const reading = buildMeterReading(house, tick, weather, seq);
        const topic = buildMeterTopic(house.gridId, house.houseId);
        return this.mqttClient.publish(topic, JSON.stringify(reading), 1);
      })
    );

    publishResults.forEach((result, index) => {
      if (result.status === 'rejected') {
        const houseId = tickResults[index]?.house.houseId ?? 'unknown';
        this.logger.error(
          `Failed to publish reading for house "${houseId}": ${String(result.reason)}`
        );
      }
    });
  }

  /** Runs one heartbeat cycle for every grid. A failure in one house never blocks the others. */
  async runAllGridHeartbeats(): Promise<void> {
    const gridResults = await Promise.allSettled(
      this.grids.map((grid) => this.runSingleGridHeartbeat(grid))
    );

    gridResults.forEach((result, index) => {
      if (result.status === 'rejected') {
        const gridId = this.grids[index]?.gridId ?? 'unknown';
        this.logger.error(`Heartbeat failed for grid "${gridId}": ${String(result.reason)}`);
      }
    });
  }

  private async runSingleGridHeartbeat(grid: Grid): Promise<void> {
    const houses = grid.getHouses();

    const publishResults = await Promise.allSettled(
      houses.map((house) => {
        const heartbeat = buildHeartbeat(house);
        const topic = buildHeartbeatTopic(house.gridId, house.houseId);
        return this.mqttClient.publish(topic, JSON.stringify(heartbeat), 1);
      })
    );

    publishResults.forEach((result, index) => {
      if (result.status === 'rejected') {
        const houseId = houses[index]?.houseId ?? 'unknown';
        this.logger.error(
          `Failed to publish heartbeat for house "${houseId}": ${String(result.reason)}`
        );
      }
    });
  }
}