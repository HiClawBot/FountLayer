import { describe, expect, it } from "vitest";

import { createUnavailableRuntimeData } from "./lib/gateway-admin";

describe("Console runtime degradation", () => {
  it("fails closed with empty collections instead of sample accounting data", () => {
    const data = createUnavailableRuntimeData();

    expect(data.source).toBe("unavailable");
    expect(
      Object.entries(data)
        .filter(([, value]) => Array.isArray(value))
        .every(([, value]) => value.length === 0),
    ).toBe(true);
  });
});
