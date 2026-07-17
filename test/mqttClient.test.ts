import { describe, it, expect, vi, beforeEach } from 'vitest';
import { EventEmitter } from 'events';
import mqtt from 'mqtt';
import { SimulatorMqttClient } from '../src/mqtt/mqttClient.js';
import type { MqttLogger } from '../src/mqtt/mqttClient.js';

vi.mock('mqtt', () => {
  return {
    default: {
      connect: vi.fn(),
    },
  };
});

class FakeMqttClient extends EventEmitter {
  connected = false;
  publish = vi.fn((_topic: string, _payload: string, _opts: unknown, callback: (err?: Error) => void) => {
    callback();
  });
  end = vi.fn((_force: boolean, _opts: unknown, callback: () => void) => {
    callback();
  });
}

function makeFakeLogger(): MqttLogger & { calls: { level: string; msg: string }[] } {
  const calls: { level: string; msg: string }[] = [];
  return {
    calls,
    info: (msg: string) => calls.push({ level: 'info', msg }),
    warn: (msg: string) => calls.push({ level: 'warn', msg }),
    error: (msg: string) => calls.push({ level: 'error', msg }),
  };
}

describe('SimulatorMqttClient - reconnection handling', () => {
  let fakeClient: FakeMqttClient;

  beforeEach(() => {
    fakeClient = new FakeMqttClient();
    vi.mocked(mqtt.connect).mockReturnValue(fakeClient as never);
  });

  it('logs a warning each time a reconnect attempt occurs', async () => {
    const logger = makeFakeLogger();
    const client = new SimulatorMqttClient({ host: 'localhost', port: 1883 }, logger);

    const connectPromise = client.connect();
    fakeClient.emit('connect');
    await connectPromise;

    fakeClient.emit('reconnect');
    fakeClient.emit('reconnect');

    const reconnectLogs = logger.calls.filter((c) => c.msg.includes('reconnection'));
    expect(reconnectLogs).toHaveLength(2);
  });

  it('tracks the reconnect count', async () => {
    const client = new SimulatorMqttClient({ host: 'localhost', port: 1883 });

    const connectPromise = client.connect();
    fakeClient.emit('connect');
    await connectPromise;

    fakeClient.emit('reconnect');
    fakeClient.emit('reconnect');
    fakeClient.emit('reconnect');

    expect(client.getReconnectCount()).toBe(3);
  });

  it('logs an info message when the client successfully reconnects after attempts', async () => {
    const logger = makeFakeLogger();
    const client = new SimulatorMqttClient({ host: 'localhost', port: 1883 }, logger);

    const connectPromise = client.connect();
    fakeClient.emit('connect');
    await connectPromise;

    fakeClient.emit('reconnect');
    fakeClient.emit('connect'); // reconnected successfully

    const successLogs = logger.calls.filter((c) => c.msg.includes('reconnected successfully'));
    expect(successLogs).toHaveLength(1);
  });

  it('logs a warning when the client goes offline', async () => {
    const logger = makeFakeLogger();
    const client = new SimulatorMqttClient({ host: 'localhost', port: 1883 }, logger);

    const connectPromise = client.connect();
    fakeClient.emit('connect');
    await connectPromise;

    fakeClient.emit('offline');

    const offlineLogs = logger.calls.filter((c) => c.msg.includes('offline'));
    expect(offlineLogs).toHaveLength(1);
  });

  it('does not silently drop a message published while disconnected - it logs and rejects', async () => {
    const logger = makeFakeLogger();
    const client = new SimulatorMqttClient({ host: 'localhost', port: 1883 }, logger);

    // Never connect - client stays undefined/disconnected
    await expect(client.publish('gridx/grid01/house0001/meter', '{}')).rejects.toThrow(
      'not connected'
    );

    const droppedLogs = logger.calls.filter((c) => c.msg.includes('Dropped message'));
    expect(droppedLogs).toHaveLength(1);
  });

  it('tracks the dropped message count across multiple failed publishes', async () => {
    const client = new SimulatorMqttClient({ host: 'localhost', port: 1883 });

    await expect(client.publish('topic/a', '{}')).rejects.toThrow();
    await expect(client.publish('topic/b', '{}')).rejects.toThrow();
    await expect(client.publish('topic/c', '{}')).rejects.toThrow();

    expect(client.getDroppedMessageCount()).toBe(3);
  });

  it('does not count a message as dropped once the client is connected', async () => {
    const client = new SimulatorMqttClient({ host: 'localhost', port: 1883 });

    const connectPromise = client.connect();
    fakeClient.connected = true;
    fakeClient.emit('connect');
    await connectPromise;

    await client.publish('gridx/grid01/house0001/meter', '{}');

    expect(client.getDroppedMessageCount()).toBe(0);
  });

  it('logs an error when the underlying client emits an error after connecting', async () => {
    const logger = makeFakeLogger();
    const client = new SimulatorMqttClient({ host: 'localhost', port: 1883 }, logger);

    const connectPromise = client.connect();
    fakeClient.emit('connect');
    await connectPromise;

    fakeClient.emit('error', new Error('broker went away'));

    const errorLogs = logger.calls.filter((c) => c.msg.includes('broker went away'));
    expect(errorLogs).toHaveLength(1);
  });
});