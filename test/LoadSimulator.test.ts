import { describe, it, expect } from 'vitest';
import { calculateLoadOutput } from '../src/domain/LoadSimulator.js';

const noNoise = (): number => 0;

describe('calculateLoadOutput', () => {
  it('apartment_single has small peaks around morning and evening', () => {
    const morning = calculateLoadOutput(
      { archetype: 'apartment_single', hourOfDay: 8, scaleFactor: 1 },
      noNoise
    );
    const midday = calculateLoadOutput(
      { archetype: 'apartment_single', hourOfDay: 13, scaleFactor: 1 },
      noNoise
    );
    const evening = calculateLoadOutput(
      { archetype: 'apartment_single', hourOfDay: 19, scaleFactor: 1 },
      noNoise
    );

    expect(morning).toBeGreaterThan(midday);
    expect(evening).toBeGreaterThan(midday);
  });

  it('family_both_work is quiet all day with a sharp evening peak', () => {
    const morning = calculateLoadOutput(
      { archetype: 'family_both_work', hourOfDay: 10, scaleFactor: 1 },
      noNoise
    );
    const evening = calculateLoadOutput(
      { archetype: 'family_both_work', hourOfDay: 19, scaleFactor: 1 },
      noNoise
    );

    expect(evening).toBeGreaterThan(morning * 2);
  });

  it('family_home_daytime has steady use across the day', () => {
    const morning = calculateLoadOutput(
      { archetype: 'family_home_daytime', hourOfDay: 9, scaleFactor: 1 },
      noNoise
    );
    const midday = calculateLoadOutput(
      { archetype: 'family_home_daytime', hourOfDay: 13, scaleFactor: 1 },
      noNoise
    );
    const lateNight = calculateLoadOutput(
      { archetype: 'family_home_daytime', hourOfDay: 3, scaleFactor: 1 },
      noNoise
    );

    // Daytime hours should be noticeably higher than late night
    expect(morning).toBeGreaterThan(lateNight);
    expect(midday).toBeGreaterThan(lateNight);
  });

  it('large_house has higher usage throughout compared to apartment_single', () => {
    const apartment = calculateLoadOutput(
      { archetype: 'apartment_single', hourOfDay: 12, scaleFactor: 1 },
      noNoise
    );
    const largeHouse = calculateLoadOutput(
      { archetype: 'large_house', hourOfDay: 12, scaleFactor: 1 },
      noNoise
    );

    expect(largeHouse).toBeGreaterThan(apartment);
  });

  it('commercial_daytime is quiet at night', () => {
    const night = calculateLoadOutput(
      { archetype: 'commercial_daytime', hourOfDay: 2, scaleFactor: 1 },
      noNoise
    );
    const businessHours = calculateLoadOutput(
      { archetype: 'commercial_daytime', hourOfDay: 12, scaleFactor: 1 },
      noNoise
    );

    expect(night).toBeLessThan(businessHours);
  });

  it('commercial_daytime is busy during business hours (9am-5pm)', () => {
    const businessHours = calculateLoadOutput(
      { archetype: 'commercial_daytime', hourOfDay: 11, scaleFactor: 1 },
      noNoise
    );
    const afterHours = calculateLoadOutput(
      { archetype: 'commercial_daytime', hourOfDay: 20, scaleFactor: 1 },
      noNoise
    );

    expect(businessHours).toBeGreaterThan(afterHours);
  });

  it('commercial_daytime steps down right at 9am and 5pm boundaries', () => {
    const beforeOpen = calculateLoadOutput(
      { archetype: 'commercial_daytime', hourOfDay: 8.9, scaleFactor: 1 },
      noNoise
    );
    const justOpened = calculateLoadOutput(
      { archetype: 'commercial_daytime', hourOfDay: 9, scaleFactor: 1 },
      noNoise
    );
    const justClosed = calculateLoadOutput(
      { archetype: 'commercial_daytime', hourOfDay: 17, scaleFactor: 1 },
      noNoise
    );

    expect(justOpened).toBeGreaterThan(beforeOpen);
    expect(justClosed).toBeLessThan(calculateLoadOutput(
      { archetype: 'commercial_daytime', hourOfDay: 16.9, scaleFactor: 1 },
      noNoise
    ));
  });

  it('scale factor proportionally increases consumption', () => {
    const small = calculateLoadOutput(
      { archetype: 'family_both_work', hourOfDay: 19, scaleFactor: 1 },
      noNoise
    );
    const large = calculateLoadOutput(
      { archetype: 'family_both_work', hourOfDay: 19, scaleFactor: 2 },
      noNoise
    );

    expect(large).toBeCloseTo(small * 2, 5);
  });

  it('never produces negative consumption even with strongly negative noise', () => {
    const result = calculateLoadOutput(
      { archetype: 'apartment_single', hourOfDay: 12, scaleFactor: 1 },
      () => -1
    );
    expect(result).toBeGreaterThanOrEqual(0);
  });

  it('throws on an unrecognized archetype', () => {
    expect(() =>
      calculateLoadOutput({
        // @ts-expect-error - intentionally testing invalid input
        archetype: 'not_a_real_archetype',
        hourOfDay: 12,
        scaleFactor: 1,
      })
    ).toThrow('Unknown load archetype');
  });

  it('uses real random noise by default within the expected range', () => {
    const base = calculateLoadOutput(
      { archetype: 'family_both_work', hourOfDay: 19, scaleFactor: 1 },
      noNoise
    );

    for (let i = 0; i < 20; i++) {
      const noisy = calculateLoadOutput({
        archetype: 'family_both_work',
        hourOfDay: 19,
        scaleFactor: 1,
      });

      expect(noisy).toBeGreaterThanOrEqual(base * 0.9);
      expect(noisy).toBeLessThanOrEqual(base * 1.1);
    }
  });
});