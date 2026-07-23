import mqtt from 'mqtt';

const TEST_DURATION_MS = 35000; // slightly longer than the k6 run

interface IsolationViolation {
  topic: string;
  payloadGridId: string;
  topicGridId: string;
}

async function main(): Promise<void> {
  console.log('Starting zone isolation test - listening on gridx/#...\n');

  const client = mqtt.connect('mqtt://localhost:1883');

  await new Promise<void>((resolve, reject) => {
    client.once('connect', () => { resolve(); });
    client.once('error', (err) => { reject(err); });
  });

  client.subscribe('gridx/#', { qos: 1 });

  let totalMessages = 0;
  const violations: IsolationViolation[] = [];
  const seenGrids = new Set<string>();

  client.on('message', (topic: string, payload: Buffer) => {
    totalMessages += 1;

    const topicParts = topic.split('/'); // gridx/{grid_id}/{house_id}/meter or /heartbeat
    const topicGridId = topicParts[1] ?? '';
    const topicHouseId = topicParts[2] ?? '';

    seenGrids.add(topicGridId);

    let parsed: { grid_id?: string; house_id?: string };
    try {
      parsed = JSON.parse(payload.toString()) as { grid_id?: string; house_id?: string };
    } catch {
      console.warn(`Could not parse payload on topic "${topic}", skipping content check`);
      return;
    }

    // Check 1: payload's grid_id must match the topic's grid segment
    if (parsed.grid_id && parsed.grid_id !== topicGridId) {
      violations.push({ topic, payloadGridId: parsed.grid_id, topicGridId });
    }

    // Check 2: house_id must belong to the topic's grid (via naming convention grid0X-houseNNNN)
    if (parsed.house_id && topicHouseId && !parsed.house_id.startsWith(topicGridId)) {
      violations.push({ topic, payloadGridId: parsed.house_id, topicGridId });
    }
  });

  console.log(`Listening for ${String(TEST_DURATION_MS / 1000)} seconds...\n`);
  await new Promise((resolve) => setTimeout(resolve, TEST_DURATION_MS));

  client.end();

  console.log('--- ZONE ISOLATION RESULTS ---');
  console.log(`Total messages observed: ${String(totalMessages)}`);
  console.log(`Distinct grids observed: ${String(seenGrids.size)} (${Array.from(seenGrids).join(', ')})`);
  console.log(`Isolation violations: ${String(violations.length)}`);

  if (violations.length > 0) {
    console.error('\nVIOLATIONS FOUND:');
    violations.forEach((v) => {
      console.error(`  Topic "${v.topic}" carried mismatched grid data: "${v.payloadGridId}" vs expected "${v.topicGridId}"`);
    });
    process.exit(1);
  }

  if (totalMessages === 0) {
    console.error('\nFAIL: no messages were observed at all - is the simulator/load test actually running?');
    process.exit(1);
  }

  if (seenGrids.size < 3) {
    console.error(`\nFAIL: expected at least 3 distinct grids, only observed ${String(seenGrids.size)}`);
    process.exit(1);
  }

  console.log('\nPASS: zero isolation violations, all grids correctly separated.');
  process.exit(0);
}

main().catch((err: unknown) => {
  console.error('Zone isolation test failed with an unexpected error:', err);
  process.exit(1);
});