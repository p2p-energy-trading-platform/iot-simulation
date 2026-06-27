import { describe, it, expect } from 'vitest';

// A dead-simple inline function to test
const absoluteSum = (a: number, b: number): number => Math.abs(a + b);

describe('Basic Infrastructure Sanity Check', () => {

  it('should successfully add two positive integers together', () => {
    const result = absoluteSum(2, 3);
    
    // Assert exactly what we expect
    expect(result).toBe(5);
  });

  it('should verify basic runtime string operations work', () => {
    const message = 'GridX IoT Simulator Ready';
    
    expect(message).toContain('IoT');
    expect(message.toLowerCase()).toEqual(expect.stringContaining('gridx'));
  });

});