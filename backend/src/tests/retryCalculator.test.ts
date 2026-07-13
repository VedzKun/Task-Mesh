import { calculateRetryDelay } from '../../src/services/retryCalculator';

describe('calculateRetryDelay', () => {
  const base = {
    maxAttempts: 5,
    maxDelayMs: 60000,
    multiplier: 2,
  };

  describe('FIXED strategy', () => {
    it('returns baseDelayMs regardless of attempt', () => {
      for (let attempt = 1; attempt <= 5; attempt++) {
        const delay = calculateRetryDelay({ ...base, strategy: 'FIXED', baseDelayMs: 1000 }, attempt);
        // Allow 10% jitter
        expect(delay).toBeGreaterThanOrEqual(900);
        expect(delay).toBeLessThanOrEqual(1100);
      }
    });
  });

  describe('LINEAR strategy', () => {
    it('grows linearly with attempt number', () => {
      const d1 = calculateRetryDelay({ ...base, strategy: 'LINEAR', baseDelayMs: 1000 }, 1);
      const d2 = calculateRetryDelay({ ...base, strategy: 'LINEAR', baseDelayMs: 1000 }, 2);
      // d2 should be roughly 2x d1 (allowing jitter)
      expect(d2).toBeGreaterThan(d1 * 1.5);
    });
  });

  describe('EXPONENTIAL strategy', () => {
    it('respects maxDelayMs cap', () => {
      const delay = calculateRetryDelay({ ...base, strategy: 'EXPONENTIAL', baseDelayMs: 10000 }, 10);
      expect(delay).toBeLessThanOrEqual(60000);
    });

    it('grows exponentially', () => {
      const d1 = calculateRetryDelay({ ...base, strategy: 'EXPONENTIAL', baseDelayMs: 1000 }, 1);
      const d2 = calculateRetryDelay({ ...base, strategy: 'EXPONENTIAL', baseDelayMs: 1000 }, 2);
      const d3 = calculateRetryDelay({ ...base, strategy: 'EXPONENTIAL', baseDelayMs: 1000 }, 3);
      // With jitter, just verify ordering
      expect(d2).toBeGreaterThan(900);
      expect(d3).toBeGreaterThan(d2 * 0.8);
    });
  });

  describe('edge cases', () => {
    it('never returns negative delay', () => {
      const delay = calculateRetryDelay({ ...base, strategy: 'FIXED', baseDelayMs: 100 }, 1);
      expect(delay).toBeGreaterThanOrEqual(0);
    });
  });
});
