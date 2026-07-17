import * as dotenv from 'dotenv';
import * as path from 'path';
import pino from 'pino';
import { loadConfig } from './config/loadConfig.js';
import { SimState } from './store/simState.js';
import { generateHouses } from './domain/HouseFactory.js';
import { Grid } from './domain/Grid.js';
import { SimulatorMqttClient } from './mqtt/mqttClient.js';
import { TickLoop } from './scheduler/tickLoop.js';
import type { MqttLogger } from './mqtt/mqttClient.js';
import { ACTUATION_COMMAND_TOPIC } from './mqtt/topics.js';
import { handleActuationMessage } from './mqtt/actuationHandler.js';

// Load environment configuration
dotenv.config();

// Initialize pino logger
const logger = pino({
  level: process.env.LOG_LEVEL ?? 'info',
  transport: process.env.NODE_ENV === 'development' ? { target: 'pino-pretty' } : undefined,
});

// Adapt pino to the MqttLogger interface used by mqttClient.ts and tickLoop.ts
const mqttLogger: MqttLogger = {
  info: (msg: string) => { logger.info(msg); },
  warn: (msg: string) => { logger.warn(msg); },
  error: (msg: string) => { logger.error(msg); },
};

// Track runtime task schedules to clean them up on exit
let tickLoop: TickLoop | undefined;
let mqttClient: SimulatorMqttClient | undefined;

async function bootstrap(): Promise<void> {
  logger.info('Initializing GridX IoT Microgrid Simulator Engine...');

  try {
    // Load Topology Configuration Profiles
    const configPath = path.join(import.meta.dirname, '../config/grids.yaml');
    logger.debug({ configPath }, 'Loading simulator engine profiles...');
    const topology = loadConfig(configPath);

    // Instantiate State Storage Manifest
    const simState = new SimState();

    // Generate houses for every grid and populate the state store
    const grids = topology.grids.map((gridConfig) => {
      const houses = generateHouses(gridConfig);
      houses.forEach((house) => { simState.addHouse(house); });
      return new Grid(gridConfig, simState);
    });

    logger.info(
      { gridCount: grids.length, houseCount: simState.houseCount },
      'Generated grids and houses from config'
    );

    // Connect to Shared Core Infrastructure Network Transport Broker
    const host = process.env.MQTT_HOST ?? 'localhost';
    const port = Number(process.env.MQTT_PORT ?? '1883');

    mqttClient = new SimulatorMqttClient({ host, port }, mqttLogger);
    await mqttClient.connect();
    logger.info({ host, port }, 'Connected to MQTT broker');

    await mqttClient.subscribe(ACTUATION_COMMAND_TOPIC, (_topic, payload) => {
      handleActuationMessage(payload, simState, mqttLogger);
    });
    logger.info({ topic: ACTUATION_COMMAND_TOPIC }, 'Subscribed to actuation command topic');

    // Fire Smart meter device System Heartbeats and Main Telemetry Simulation Ticks (Non-Blocking)
    tickLoop = new TickLoop({
      grids,
      mqttClient,
      tickIntervalMs: Number(process.env.TICK_INTERVAL_MS ?? '5000'),
      heartbeatIntervalMs: Number(process.env.HEARTBEAT_INTERVAL_MS ?? '60000'),
      logger: mqttLogger,
    });
    tickLoop.start();

    logger.info('GridX Simulator engine successfully deployed onto the event loop.');

    // Graceful Degradation Handler Context
    const handleShutdown = (signal: string): void => {
      logger.warn(`\nSystem received ${signal}. Beginning process cleanup lifecycle...`);

      tickLoop?.stop();
      logger.info('Cleared execution timers.');

      void mqttClient?.disconnect().then(() => {
        logger.info('GridX Simulator application cleanly terminated.');
        process.exit(0);
      });
    };

    process.on('SIGINT', () => {
      handleShutdown('SIGINT');
    });
    process.on('SIGTERM', () => {
      handleShutdown('SIGTERM');
    });

  } catch (criticalError) {
    logger.fatal(criticalError, 'Fatal Exception occurred during microservice initialization lifecycle');
    process.exit(1);
  }
}

void bootstrap();