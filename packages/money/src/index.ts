export const moneyScale = 8;
export const rateScale = 6;

function scaleFactor(scale: number): bigint {
  if (!Number.isInteger(scale) || scale < 0 || scale > 18) {
    throw new Error("Fixed-point scale must be an integer from 0 to 18.");
  }

  return 10n ** BigInt(scale);
}

export function parseFixed(value: string, scale: number): bigint {
  if (typeof value !== "string") {
    throw new Error("Fixed-point value must be a decimal string.");
  }

  const normalized = value.trim();

  if (normalized.length > 128) {
    throw new Error("Fixed-point value is too long.");
  }

  const match =
    /^(?<sign>-?)(?<whole>0|[1-9]\d*)(?:\.(?<fraction>\d+))?$/u.exec(
      normalized,
    );

  if (!match?.groups?.whole) {
    throw new Error(`Invalid decimal value: ${value}`);
  }

  const { sign, whole } = match.groups;
  const fraction = match.groups.fraction ?? "";

  if (fraction.length > scale) {
    throw new Error(
      `Decimal value exceeds ${scale} fractional digits: ${value}`,
    );
  }

  const magnitude =
    BigInt(whole) * scaleFactor(scale) +
    BigInt(fraction.padEnd(scale, "0") || "0");

  return sign === "-" ? -magnitude : magnitude;
}

export function formatFixed(value: bigint, scale: number): string {
  const factor = scaleFactor(scale);
  const negative = value < 0n;
  const magnitude = negative ? -value : value;
  const whole = magnitude / factor;

  if (scale === 0) {
    return `${negative ? "-" : ""}${whole}`;
  }

  const fraction = (magnitude % factor).toString().padStart(scale, "0");

  return `${negative ? "-" : ""}${whole}.${fraction}`;
}

export function divideRoundHalfUp(
  numerator: bigint,
  denominator: bigint,
): bigint {
  if (numerator < 0n || denominator <= 0n) {
    throw new Error("Rounded division requires a non-negative numerator.");
  }

  const quotient = numerator / denominator;
  const remainder = numerator % denominator;

  return remainder * 2n >= denominator ? quotient + 1n : quotient;
}

export function parseMoney(value: string): bigint {
  const parsed = parseFixed(value, moneyScale);

  if (parsed < 0n) {
    throw new Error(`Money value must be non-negative: ${value}`);
  }

  return parsed;
}

export function formatMoney(value: bigint): string {
  if (value < 0n) {
    throw new Error("Money value must be non-negative.");
  }

  return formatFixed(value, moneyScale);
}

export function compareMoney(left: string, right: string): number {
  const difference = parseMoney(left) - parseMoney(right);
  return difference < 0n ? -1 : difference > 0n ? 1 : 0;
}

export function addMoney(...values: string[]): string {
  return formatMoney(
    values.reduce((total, value) => total + parseMoney(value), 0n),
  );
}

export function subtractMoney(left: string, right: string): string {
  const difference = parseMoney(left) - parseMoney(right);

  if (difference < 0n) {
    throw new Error("Money subtraction would produce a negative value.");
  }

  return formatMoney(difference);
}

export function multiplyMoneyByRate(amount: string, rate: string): string {
  const rateUnits = parseFixed(rate, rateScale);

  if (rateUnits < 0n) {
    throw new Error(`Rate must be non-negative: ${rate}`);
  }

  return formatMoney(
    divideRoundHalfUp(parseMoney(amount) * rateUnits, scaleFactor(rateScale)),
  );
}
