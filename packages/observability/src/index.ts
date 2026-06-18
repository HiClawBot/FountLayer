export type TelemetryValue = boolean | number | string;

export type TelemetryEvent = {
  attributes: Record<string, TelemetryValue>;
  name: string;
  timestamp: string;
};

export type TelemetryMetric = {
  attributes: Record<string, TelemetryValue>;
  name: string;
  timestamp: string;
  unit?: string;
  value: number;
};

export type TelemetrySpan = {
  attributes: Record<string, TelemetryValue>;
  durationMs: number;
  name: string;
  status: "error" | "ok";
  timestamp: string;
};

export type TelemetrySink = {
  record(event: TelemetryEvent): Promise<void> | void;
  recordMetric?(metric: TelemetryMetric): Promise<void> | void;
  recordSpan?(span: TelemetrySpan): Promise<void> | void;
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

export function createTelemetryMetric(
  name: string,
  value: number,
  attributes: Record<string, unknown>,
  options: {
    timestamp?: string;
    unit?: string;
  } = {},
): TelemetryMetric {
  return {
    attributes: sanitizeTelemetryAttributes(attributes),
    name,
    timestamp: options.timestamp ?? new Date().toISOString(),
    unit: options.unit,
    value,
  };
}

export function createTelemetrySpan(
  name: string,
  input: {
    attributes: Record<string, unknown>;
    durationMs: number;
    status: "error" | "ok";
    timestamp?: string;
  },
): TelemetrySpan {
  return {
    attributes: sanitizeTelemetryAttributes(input.attributes),
    durationMs: Math.max(0, Math.round(input.durationMs)),
    name,
    status: input.status,
    timestamp: input.timestamp ?? new Date().toISOString(),
  };
}

export function createInMemoryTelemetrySink(): TelemetrySink & {
  events: TelemetryEvent[];
  metrics: TelemetryMetric[];
  spans: TelemetrySpan[];
} {
  const events: TelemetryEvent[] = [];
  const metrics: TelemetryMetric[] = [];
  const spans: TelemetrySpan[] = [];

  return {
    events,
    metrics,
    record(event) {
      events.push(event);
    },
    recordMetric(metric) {
      metrics.push(metric);
    },
    recordSpan(span) {
      spans.push(span);
    },
    spans,
  };
}
