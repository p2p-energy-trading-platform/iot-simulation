import { describe, it, expect } from 'vitest';
import { buildMeterTopic, buildHeartbeatTopic } from '../src/mqtt/topics.js';

describe('buildMeterTopic', () => {
  it('follows the gridx/{grid_id}/{house_id}/meter format', () => {
    expect(buildMeterTopic('grid01', 'house0042')).toBe('gridx/grid01/house0042/meter');
  });

  it('works for different grid and house IDs', () => {
    expect(buildMeterTopic('grid03', 'house0007')).toBe('gridx/grid03/house0007/meter');
  });
});

describe('buildHeartbeatTopic', () => {
  it('follows the gridx/{grid_id}/{house_id}/heartbeat format', () => {
    expect(buildHeartbeatTopic('grid01', 'house0042')).toBe('gridx/grid01/house0042/heartbeat');
  });
});