export type TelemetryValue = boolean | number | string;

export type TelemetryEvent = {
  attributes: Record<string, TelemetryValue>;
  name: string;
  timestamp: string;
};

export type TelemetrySink = {
  record(event: TelemetryEvent): Promise<void> | void;
};

const sensitiveKeyPattern =
  /(^|_|\.)((api_?)?key|authorization|bearer|content|cookie|message|output_text|password|prompt|raw|response_text|secret|token)$/i;
const secretLikeValuePattern =
  /(sk-[A-Za-z0-9_-]{20,}|AIza[0-9A-Za-z_-]{20,}|Bearer\s+[A-Za-z0-9._-]{12,})/i;

function isTelemetryValue(value: unknown): value is TelemetryValue {
  return (
    typeof value === "string" ||
    typeof value === "number" ||
    typeof value === "boolean"
  );
}

export function sanitizeTelemetryAttributes(
  attributes: Record<string, unknown>,
): Record<string, TelemetryValue> {
  const sanitized: Record<string, TelemetryValue> = {};

  for (const [key, value] of Object.entries(attributes)) {
    const normalizedKey = key.replace(/[A-Z]/g, "_$&").toLowerCase();

    if (sensitiveKeyPattern.test(normalizedKey) || !isTelemetryValue(value)) {
      continue;
    }

    sanitized[key] =
      typeof value === "string" && secretLikeValuePattern.test(value)
        ? "[redacted]"
        : value;
  }

  return sanitized;
}

export function createTelemetryEvent(
  name: string,
  attributes: Record<string, unknown>,
  timestamp = new Date().toISOString(),
): TelemetryEvent {
  return {
    attributes: sanitizeTelemetryAttributes(attributes),
    name,
    timestamp,
  };
}

export function createInMemoryTelemetrySink(): TelemetrySink & {
  events: TelemetryEvent[];
} {
  const events: TelemetryEvent[] = [];

  return {
    events,
    record(event) {
      events.push(event);
    },
  };
}
