import { loadConfig } from '../src/config/loadConfig.js';
import { SimState } from '../src/store/simState.js';
import { generateHouses } from '../src/domain/HouseFactory.js';
import { Grid } from '../src/domain/Grid.js';
import { SimulatorMqttClient } from '../src/mqtt/mqttClient.js';
import { TickLoop } from '../src/scheduler/tickLoop.js';
import * as path from 'path';
import mqtt from 'mqtt';

interface ReceivedMessage {
  gridId: string;
  houseId: string;
  topicGridId: string;
  topicHouseId: string;
  seq: number;
  receivedAt: number;
}

const TEST_DURATION_MS = 30000; // run for 30 seconds
const EXPECTED_TICK_INTERVAL_MS = 5000;

async function main(): Promise<void> {
  console.log('Starting GridX load and zone isolation test...\n');

  const configPath = path.join(import.meta.dirname, '../config/grids.yaml');
  const topology = loadConfig(configPath);

  const simState = new SimState();
  const grids = topology.grids.map((gridConfig) => {
    const houses = generateHouses(gridConfig);
    houses.forEach((house) => { simState.addHouse(house); });
    return new Grid(gridConfig, simState);
  });

  const totalHouses = simState.houseCount;
  console.log(`Generated ${String(totalHouses)} houses across ${String(grids.length)} grids`);

  if (grids.length < 3) {
    console.error(`FAIL: expected at least 3 grids, found ${String(grids.length)}`);
    process.exit(1);
  }

  if (totalHouses < 50) {
    console.error(`FAIL: expected at least 50 houses, found ${String(totalHouses)}`);
    process.exit(1);
  }

  const publisherClient = new SimulatorMqttClient({ host: 'localhost', port: 1883 });
  await publisherClient.connect();

  const tickLoop = new TickLoop({
    grids,
    mqttClient: publisherClient,
    tickIntervalMs: EXPECTED_TICK_INTERVAL_MS,
  });

  const subscriberClient = mqtt.connect('mqtt://localhost:1883');
  const receivedMessages: ReceivedMessage[] = [];

  await new Promise<void>((resolve, reject) => {
    subscriberClient.once('connect', () => { resolve(); });
    subscriberClient.once('error', (err) => { reject(err); });
  });

  subscriberClient.subscribe('gridx/#', { qos: 1 });

  subscriberClient.on('message', (topic: string, payload: Buffer) => {
    const parsed = JSON.parse(payload.toString()) as {
      grid_id: string;
      house_id: string;
      seq: number;
    };

    const topicParts = topic.split('/');
    const topicGridId = topicParts[1] ?? '';
    const topicHouseId = topicParts[2] ?? '';

    receivedMessages.push({
      gridId: parsed.grid_id,
      houseId: parsed.house_id,
      topicGridId,
      topicHouseId,
      seq: parsed.seq,
      receivedAt: Date.now(),
    });
  });

  tickLoop.start();
  console.log(`Running for ${String(TEST_DURATION_MS / 1000)} seconds...\n`);

  await new Promise((resolve) => setTimeout(resolve, TEST_DURATION_MS));

  tickLoop.stop();
  await publisherClient.disconnect();
  subscriberClient.end();

  console.log(`Total messages received: ${String(receivedMessages.length)}\n`);

  let isolationFailures = 0;
  for (const msg of receivedMessages) {
    if (msg.gridId !== msg.topicGridId) {
      isolationFailures += 1;
      console.error(
        `ISOLATION FAILURE: payload grid_id "${msg.gridId}" does not match topic grid "${msg.topicGridId}"`
      );
    }
    if (!msg.houseId.startsWith(msg.topicGridId)) {
      isolationFailures += 1;
      console.error(
        `ISOLATION FAILURE: house_id "${msg.houseId}" does not belong to topic grid "${msg.topicGridId}"`
      );
    }
  }

  // setInterval fires after the first interval elapses, and we need buffer time
// for the final tick to finish publishing all houses before we stop measuring.
const expectedTicks = Math.floor(TEST_DURATION_MS / EXPECTED_TICK_INTERVAL_MS) - 1;
const expectedMessages = totalHouses * expectedTicks;
const minimumAcceptable = expectedMessages * 0.95; // tighter tolerance now that the math is correct

  console.log(`Expected approx. ${String(expectedMessages)} messages (${String(expectedTicks)} ticks x ${String(totalHouses)} houses)`);
  console.log(`Minimum acceptable: ${String(Math.floor(minimumAcceptable))}`);

  const messageCountOk = receivedMessages.length >= minimumAcceptable;

  console.log('\n--- RESULTS ---');
  console.log(`Grids: ${String(grids.length)} (required: >=3) - ${grids.length >= 3 ? 'PASS' : 'FAIL'}`);
  console.log(`Houses: ${String(totalHouses)} (required: >=50) - ${totalHouses >= 50 ? 'PASS' : 'FAIL'}`);
  console.log(`Zone isolation: ${isolationFailures === 0 ? 'PASS' : `FAIL (${String(isolationFailures)} violations)`}`);
  console.log(`Message throughput: ${messageCountOk ? 'PASS' : 'FAIL'} (${String(receivedMessages.length)}/${String(expectedMessages)})`);

  const allPassed = grids.length >= 3 && totalHouses >= 50 && isolationFailures === 0 && messageCountOk;

  if (!allPassed) {
    process.exit(1);
  }

  console.log('\nAll load and zone isolation checks passed.');
  process.exit(0);
}

main().catch((err: unknown) => {
  console.error('Load test failed with an unexpected error:', err);
  process.exit(1);
});