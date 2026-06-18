export type RetryOptions = {
  maxAttempts?: number;
  retryable?: (error: unknown, attempt: number) => boolean;
};

export type CircuitBreakerOptions = {
  failureThreshold: number;
  now?: () => number;
  resetAfterMs: number;
};

export type CircuitBreakerState = "closed" | "half_open" | "open";

export class CircuitOpenError extends Error {
  constructor() {
    super("Circuit breaker is open.");
    this.name = "CircuitOpenError";
  }
}

export class CircuitBreaker {
  private failures = 0;
  private openedAt?: number;
  private readonly now: () => number;

  constructor(private readonly options: CircuitBreakerOptions) {
    this.now = options.now ?? (() => Date.now());
  }

  state(): CircuitBreakerState {
    if (this.openedAt === undefined) {
      return "closed";
    }

    return this.now() - this.openedAt >= this.options.resetAfterMs
      ? "half_open"
      : "open";
  }

  beforeCall(): void {
    if (this.state() === "open") {
      throw new CircuitOpenError();
    }
  }

  recordSuccess(): void {
    this.failures = 0;
    this.openedAt = undefined;
  }

  recordFailure(): void {
    this.failures += 1;

    if (this.failures >= this.options.failureThreshold) {
      this.openedAt = this.now();
    }
  }
}

export async function executeWithRetry<T>(
  operation: () => Promise<T>,
  options: RetryOptions = {},
): Promise<T> {
  const maxAttempts = Math.max(1, options.maxAttempts ?? 1);
  let attempt = 0;
  let lastError: unknown;

  while (attempt < maxAttempts) {
    attempt += 1;

    try {
      return await operation();
    } catch (error) {
      lastError = error;

      if (
        attempt >= maxAttempts ||
        options.retryable?.(error, attempt) === false
      ) {
        throw error;
      }
    }
  }

  throw lastError instanceof Error
    ? lastError
    : new Error("Retry operation failed.");
}

export async function executeWithCircuitBreaker<T>(
  operation: () => Promise<T>,
  circuitBreaker?: CircuitBreaker,
): Promise<T> {
  circuitBreaker?.beforeCall();

  try {
    const result = await operation();
    circuitBreaker?.recordSuccess();
    return result;
  } catch (error) {
    circuitBreaker?.recordFailure();
    throw error;
  }
}
