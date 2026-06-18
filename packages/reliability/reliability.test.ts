import { describe, expect, it } from "vitest";

import {
  CircuitBreaker,
  CircuitOpenError,
  executeWithCircuitBreaker,
  executeWithRetry,
} from "./src/index";

describe("reliability helpers", () => {
  it("retries retryable operations within the attempt budget", async () => {
    let attempts = 0;

    const result = await executeWithRetry(
      async () => {
        attempts += 1;

        if (attempts === 1) {
          throw new Error("temporary");
        }

        return "ok";
      },
      { maxAttempts: 2 },
    );

    expect(result).toBe("ok");
    expect(attempts).toBe(2);
  });

  it("stops retrying when retryable returns false", async () => {
    let attempts = 0;

    await expect(
      executeWithRetry(
        async () => {
          attempts += 1;
          throw new Error("permanent");
        },
        {
          maxAttempts: 3,
          retryable: () => false,
        },
      ),
    ).rejects.toThrow("permanent");
    expect(attempts).toBe(1);
  });

  it("opens and half-opens circuits after the reset window", async () => {
    let now = 1000;
    const breaker = new CircuitBreaker({
      failureThreshold: 1,
      now: () => now,
      resetAfterMs: 500,
    });

    await expect(
      executeWithCircuitBreaker(async () => {
        throw new Error("adapter failed");
      }, breaker),
    ).rejects.toThrow("adapter failed");
    expect(breaker.state()).toBe("open");
    expect(() => breaker.beforeCall()).toThrow(CircuitOpenError);

    now = 1600;

    expect(breaker.state()).toBe("half_open");

    await expect(
      executeWithCircuitBreaker(async () => "ok", breaker),
    ).resolves.toBe("ok");
    expect(breaker.state()).toBe("closed");
  });
});
