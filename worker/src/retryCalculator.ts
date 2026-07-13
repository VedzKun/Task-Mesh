import { RetryStrategy } from '@prisma/client';

interface RetryPolicyConfig {
  strategy: RetryStrategy;
  baseDelayMs: number;
  maxDelayMs: number;
  multiplier: number;
  maxAttempts: number;
}

/**
 * Calculates the next retry delay in milliseconds given a retry policy and attempt number.
 * Follows OCP: each strategy is independently addable without modifying existing logic.
 */
export function calculateRetryDelay(policy: RetryPolicyConfig, attempt: number): number {
  let delay: number;

  switch (policy.strategy) {
    case 'FIXED':
      delay = policy.baseDelayMs;
      break;

    case 'LINEAR':
      delay = policy.baseDelayMs * attempt;
      break;

    case 'EXPONENTIAL':
    default:
      delay = policy.baseDelayMs * Math.pow(policy.multiplier, attempt - 1);
      break;
  }

  // Add jitter (±10%) to prevent thundering herd
  const jitter = delay * 0.1 * (Math.random() * 2 - 1);
  return Math.min(Math.round(delay + jitter), policy.maxDelayMs);
}
