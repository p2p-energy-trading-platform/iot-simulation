import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { TickLoop } from '../src/scheduler/tickLoop.js';
import { Grid } from '../src/domain/Grid.js';
import { SimState } from '../src/store/simState.js';
import type { GridConfig } from '../src/types/config.js';
import type { HouseState } from '../src/store/simState.js';
import type { SimulatorMqttClient } from '../src/mqtt/mqttClient.js';

function makeGridConfig(overrides: Partial<GridConfig> = {}): GridConfig {
  return {
    grid_id: 'grid01',
    location: { lat: 6.9271, lon: 79.8612 },
    houses: 2,
    prosumer_ratio: 0.5,
    battery_ratio: 0,
    commercial_count: 0,
    ...overrides,
  };
}

function makeHouse(overrides: Partial<HouseState> = {}): HouseState {
  return {
    houseId: 'house0001',
    gridId: 'grid01',
    deviceClass: 'consumer',
    loadArchetype: 'family_both_work',
    loadScaleFactor: 1.0,
    ratedSolarKw: 0,
    panelEfficiencyFactor: 0,
    flexibleAssets: [],
    ...overrides,
  };
}

function mockFetchSuccess(): void {
  vi.stubGlobal(
    'fetch',
    vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: () =>
        Promise.resolve({
          current: {
            shortwave_radiation: 500,
            direct_radiation: 375,
            diffuse_radiation: 125,
            cloud_cover: 10,
            temperature_2m: 28,
            time: '2026-07-02T12:00',
          },
        }),
    })
  );
}

function makeFakeMqttClient(): SimulatorMqttClient & { publishCalls: { topic: string; payload: string }[] } {
  const publishCalls: { topic: string; payload: string }[] = [];
  return {
    publishCalls,
    publish: vi.fn((topic: string, payload: string) => {
      publishCalls.push({ topic, payload });
      return Promise.resolve();
    }),
  } as unknown as SimulatorMqttClient & { publishCalls: { topic: string; payload: string }[] };
}

describe('TickLoop', () => {
  beforeEach(() => {
    mockFetchSuccess();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it('publishes a reading for every house across every grid in one tick cycle', async () => {
    const state = new SimState();
    state.addHouse(makeHouse({ houseId: 'house0001', gridId: 'grid01' }));
    state.addHouse(makeHouse({ houseId: 'house0002', gridId: 'grid01' }));

    const grid = new Grid(makeGridConfig({ grid_id: 'grid01' }), state);
    const mqttClient = makeFakeMqttClient();
    const tickLoop = new TickLoop({ grids: [grid], mqttClient });

    await tickLoop.runAllGridTicks();

    expect(mqttClient.publishCalls).toHaveLength(2);
  });

  it('processes multiple grids in a single tick cycle', async () => {
    const state = new SimState();
    state.addHouse(makeHouse({ houseId: 'house0001', gridId: 'grid01' }));
    state.addHouse(makeHouse({ houseId: 'house0002', gridId: 'grid02' }));
    state.addHouse(makeHouse({ houseId: 'house0003', gridId: 'grid03' }));

    const grid01 = new Grid(makeGridConfig({ grid_id: 'grid01' }), state);
    const grid02 = new Grid(makeGridConfig({ grid_id: 'grid02' }), state);
    const grid03 = new Grid(makeGridConfig({ grid_id: 'grid03' }), state);

    const mqttClient = makeFakeMqttClient();
    const tickLoop = new TickLoop({ grids: [grid01, grid02, grid03], mqttClient });

    await tickLoop.runAllGridTicks();

    expect(mqttClient.publishCalls).toHaveLength(3);
  });

  it('publishes to the correct topic per house', async () => {
    const state = new SimState();
    state.addHouse(makeHouse({ houseId: 'house0042', gridId: 'grid01' }));

    const grid = new Grid(makeGridConfig({ grid_id: 'grid01' }), state);
    const mqttClient = makeFakeMqttClient();
    const tickLoop = new TickLoop({ grids: [grid], mqttClient });

    await tickLoop.runAllGridTicks();

    expect(mqttClient.publishCalls[0]?.topic).toBe('gridx/grid01/house0042/meter');
  });

  it('a failed publish for one house does not stop other houses from publishing', async () => {
    const state = new SimState();
    state.addHouse(makeHouse({ houseId: 'house0001', gridId: 'grid01' }));
    state.addHouse(makeHouse({ houseId: 'house0002', gridId: 'grid01' }));
    state.addHouse(makeHouse({ houseId: 'house0003', gridId: 'grid01' }));

    const grid = new Grid(makeGridConfig({ grid_id: 'grid01' }), state);

    let callCount = 0;
    const mqttClient = {
      publish: vi.fn(() => {
        callCount += 1;
        if (callCount === 2) {
          return Promise.reject(new Error('simulated publish failure'));
        }
        return Promise.resolve();
      }),
    } as unknown as SimulatorMqttClient;

    const tickLoop = new TickLoop({ grids: [grid], mqttClient });

    await expect(tickLoop.runAllGridTicks()).resolves.toBeUndefined();

    // eslint-disable-next-line @typescript-eslint/unbound-method
    expect(mqttClient.publish).toHaveBeenCalledTimes(3);
  });

  it('a slow house does not delay other houses in the same tick', async () => {
    const state = new SimState();
    state.addHouse(makeHouse({ houseId: 'house0001', gridId: 'grid01' }));
    state.addHouse(makeHouse({ houseId: 'house0002', gridId: 'grid01' }));

    const grid = new Grid(makeGridConfig({ grid_id: 'grid01' }), state);

    const publishOrder: string[] = [];
    const mqttClient = {
      publish: vi.fn((topic: string) => {
        if (topic.includes('house0001')) {
          return new Promise<void>((resolve) => {
            setTimeout(() => {
              publishOrder.push('house0001');
              resolve();
            }, 1000);
          });
        }
        publishOrder.push('house0002');
        return Promise.resolve();
      }),
    } as unknown as SimulatorMqttClient;

    const tickLoop = new TickLoop({ grids: [grid], mqttClient });

    const tickPromise = tickLoop.runAllGridTicks();
    await vi.advanceTimersByTimeAsync(1000);
    await tickPromise;

    expect(publishOrder[0]).toBe('house0002');
    expect(publishOrder[1]).toBe('house0001');
  });

  it('publishes a heartbeat for every house on runAllGridHeartbeats', async () => {
    const state = new SimState();
    state.addHouse(makeHouse({ houseId: 'house0001', gridId: 'grid01' }));
    state.addHouse(makeHouse({ houseId: 'house0002', gridId: 'grid01' }));

    const grid = new Grid(makeGridConfig({ grid_id: 'grid01' }), state);
    const mqttClient = makeFakeMqttClient();
    const tickLoop = new TickLoop({ grids: [grid], mqttClient });

    await tickLoop.runAllGridHeartbeats();

    expect(mqttClient.publishCalls).toHaveLength(2);
    expect(mqttClient.publishCalls[0]?.topic).toContain('/heartbeat');
  });

  it('uses the configured tick interval, not a hardcoded one', () => {
    const state = new SimState();
    const grid = new Grid(makeGridConfig(), state);
    const mqttClient = makeFakeMqttClient();

    const tickLoop = new TickLoop({
      grids: [grid],
      mqttClient,
      tickIntervalMs: 1000,
    });

    const setIntervalSpy = vi.spyOn(global, 'setInterval');
    tickLoop.start();

    expect(setIntervalSpy).toHaveBeenCalledWith(expect.any(Function), 1000);
    tickLoop.stop();
  });

  it('start() schedules recurring ticks and stop() cancels them', () => {
    const state = new SimState();
    state.addHouse(makeHouse({ houseId: 'house0001', gridId: 'grid01' }));

    const grid = new Grid(makeGridConfig({ grid_id: 'grid01' }), state);
    const mqttClient = makeFakeMqttClient();

    const tickLoop = new TickLoop({ grids: [grid], mqttClient, tickIntervalMs: 1000 });

    tickLoop.start();
    tickLoop.stop();

    const callsBeforeAdvance = mqttClient.publishCalls.length;
    vi.advanceTimersByTime(5000);
    expect(mqttClient.publishCalls.length).toBe(callsBeforeAdvance);
  });

  it('sequence numbers increment per house across multiple ticks', async () => {
    const state = new SimState();
    state.addHouse(makeHouse({ houseId: 'house0001', gridId: 'grid01' }));

    const grid = new Grid(makeGridConfig({ grid_id: 'grid01' }), state);
    const mqttClient = makeFakeMqttClient();
    const tickLoop = new TickLoop({ grids: [grid], mqttClient });

    await tickLoop.runAllGridTicks();
    await tickLoop.runAllGridTicks();

    const firstPayload = JSON.parse(mqttClient.publishCalls[0]?.payload ?? '{}') as { seq: number };
    const secondPayload = JSON.parse(mqttClient.publishCalls[1]?.payload ?? '{}') as { seq: number };

    expect(firstPayload.seq).toBe(1);
    expect(secondPayload.seq).toBe(2);
  });
});