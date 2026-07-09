import { describe, it, expect, vi, beforeEach } from 'vitest';
import { EventEmitter } from 'events';

// Mock the entire 'mqtt' package before importing SimulatorMqttClient
vi.mock('mqtt', () => {
  return {
    default: {
      connect: vi.fn(),
    },
  };
});

import mqtt from 'mqtt';
import { SimulatorMqttClient } from '../src/mqtt/mqttClient.js';

class FakeMqttClient extends EventEmitter {
  connected = false;
  publish = vi.fn((_topic: string, _payload: string, _opts: unknown, callback: (err?: Error) => void) => {
    callback();
  });
  end = vi.fn((_force: boolean, _opts: unknown, callback: () => void) => {
    callback();
  });
}

describe('SimulatorMqttClient', () => {
  let fakeClient: FakeMqttClient;

  beforeEach(() => {
    fakeClient = new FakeMqttClient();
    vi.mocked(mqtt.connect).mockReturnValue(fakeClient as never);
  });

  it('resolves connect() once the underlying client emits "connect"', async () => {
    const client = new SimulatorMqttClient({ host: 'localhost', port: 1883 });

    const connectPromise = client.connect();
    fakeClient.emit('connect');

    await expect(connectPromise).resolves.toBeUndefined();
  });

  it('rejects connect() if the underlying client emits an error before connecting', async () => {
    const client = new SimulatorMqttClient({ host: 'localhost', port: 1883 });

    const connectPromise = client.connect();
    fakeClient.emit('error', new Error('connection refused'));

    await expect(connectPromise).rejects.toThrow('connection refused');
  });

  it('publishes a message successfully with QoS 1 by default', async () => {
    const client = new SimulatorMqttClient({ host: 'localhost', port: 1883 });

    const connectPromise = client.connect();
    fakeClient.emit('connect');
    await connectPromise;

    await client.publish('gridx/grid01/house0001/meter', '{"solar_kw":1.2}');

    expect(fakeClient.publish).toHaveBeenCalledWith(
      'gridx/grid01/house0001/meter',
      '{"solar_kw":1.2}',
      { qos: 1 },
      expect.any(Function)
    );
  });

  it('publishes with a custom QoS when specified', async () => {
    const client = new SimulatorMqttClient({ host: 'localhost', port: 1883 });

    const connectPromise = client.connect();
    fakeClient.emit('connect');
    await connectPromise;

    await client.publish('gridx/grid01/house0001/meter', '{}', 0);

    expect(fakeClient.publish).toHaveBeenCalledWith(
      'gridx/grid01/house0001/meter',
      '{}',
      { qos: 0 },
      expect.any(Function)
    );
  });

  it('rejects publish() if called before connect()', async () => {
    const client = new SimulatorMqttClient({ host: 'localhost', port: 1883 });

    await expect(client.publish('some/topic', '{}')).rejects.toThrow('not connected');
  });

  it('rejects publish() if the underlying client reports an error', async () => {
    const client = new SimulatorMqttClient({ host: 'localhost', port: 1883 });

    const connectPromise = client.connect();
    fakeClient.emit('connect');
    await connectPromise;

    fakeClient.publish = vi.fn((_t: string, _p: string, _o: unknown, cb: (err?: Error) => void) => {
      cb(new Error('publish failed: broker rejected message'));
    });

    await expect(client.publish('some/topic', '{}')).rejects.toThrow('publish failed');
  });

  it('resolves disconnect() cleanly', async () => {
    const client = new SimulatorMqttClient({ host: 'localhost', port: 1883 });

    const connectPromise = client.connect();
    fakeClient.emit('connect');
    await connectPromise;

    await expect(client.disconnect()).resolves.toBeUndefined();
    expect(fakeClient.end).toHaveBeenCalled();
  });

  it('disconnect() resolves even if never connected', async () => {
    const client = new SimulatorMqttClient({ host: 'localhost', port: 1883 });
    await expect(client.disconnect()).resolves.toBeUndefined();
  });

  it('isConnected reflects the underlying client connection state', async () => {
    const client = new SimulatorMqttClient({ host: 'localhost', port: 1883 });

    expect(client.isConnected()).toBe(false);

    const connectPromise = client.connect();
    fakeClient.connected = true;
    fakeClient.emit('connect');
    await connectPromise;

    expect(client.isConnected()).toBe(true);
  });
});