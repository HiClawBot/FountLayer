import { describe, expect, it } from "vitest";

import {
  addMoney,
  compareMoney,
  divideRoundHalfUp,
  formatFixed,
  formatMoney,
  multiplyMoneyByRate,
  parseFixed,
  parseMoney,
  subtractMoney,
} from "./src/index";

describe("fixed-point money", () => {
  it("parses and formats decimal strings exactly", () => {
    expect(parseMoney("90071992.54740991")).toBe(9007199254740991n);
    expect(formatMoney(9007199254740991n)).toBe("90071992.54740991");
    expect(parseFixed("0.250000", 6)).toBe(250000n);
    expect(formatFixed(-125000n, 6)).toBe("-0.125000");
  });

  it("adds, subtracts, compares, and multiplies without binary floats", () => {
    expect(addMoney("0.10000000", "0.20000000")).toBe("0.30000000");
    expect(subtractMoney("1.00000000", "0.33333333")).toBe("0.66666667");
    expect(compareMoney("0.10000000", "0.09999999")).toBe(1);
    expect(multiplyMoneyByRate("0.00000003", "0.500000")).toBe("0.00000002");
  });

  it("rounds half up and rejects precision loss or negative money", () => {
    expect(divideRoundHalfUp(5n, 2n)).toBe(3n);
    expect(() => parseMoney("0.000000001")).toThrow("exceeds 8");
    expect(() => parseMoney("-0.00000001")).toThrow("non-negative");
    expect(() => subtractMoney("0.10000000", "0.20000000")).toThrow("negative");
  });
});
