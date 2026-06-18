import { describe, expect, it } from "vitest";

import {
  createInMemoryTelemetrySink,
  createTelemetryEvent,
  createTelemetryMetric,
  createTelemetrySpan,
  sanitizeTelemetryAttributes,
} from "./src/index";

describe("observability", () => {
  it("drops prompt, output, token, and key-like attributes", () => {
    const attributes = sanitizeTelemetryAttributes({
      appId: "app_pdf_reader",
      authorization: "Bearer local-placeholder-token",
      outputText: "assistant response",
      prompt: "Summarize this paper.",
      providerApiKey: "provider-secret-placeholder",
      totalTokens: 15,
    });

    expect(attributes).toEqual({
      appId: "app_pdf_reader",
      totalTokens: 15,
    });
  });

  it("redacts secret-like values even under safe keys", () => {
    const attributes = sanitizeTelemetryAttributes({
      appId: "app_pdf_reader",
      note: "Bearer local-placeholder-token",
      routeAlias: "vertical/paper-summary",
    });

    expect(attributes).toEqual({
      appId: "app_pdf_reader",
      note: "[redacted]",
      routeAlias: "vertical/paper-summary",
    });
  });

  it("records sanitized in-memory telemetry events", () => {
    const sink = createInMemoryTelemetrySink();
    const event = createTelemetryEvent(
      "gateway.chat.success",
      {
        appId: "app_pdf_reader",
        messages: [{ role: "user", content: "secret prompt" }],
        retailPrice: "0.00340000",
      },
      "2026-06-18T00:00:00.000Z",
    );

    sink.record(event);

    expect(sink.events).toEqual([
      {
        attributes: {
          appId: "app_pdf_reader",
          retailPrice: "0.00340000",
        },
        name: "gateway.chat.success",
        timestamp: "2026-06-18T00:00:00.000Z",
      },
    ]);
  });

  it("records sanitized metrics and spans", () => {
    const sink = createInMemoryTelemetrySink();
    const metric = createTelemetryMetric(
      "gateway.tokens",
      15,
      {
        appId: "app_pdf_reader",
        prompt: "secret prompt",
      },
      {
        timestamp: "2026-06-18T00:00:00.000Z",
        unit: "tokens",
      },
    );
    const span = createTelemetrySpan("gateway.adapter.call", {
      attributes: {
        provider: "demo",
        raw: {
          output: "secret",
        },
        routeId: "route_paper_summary",
      },
      durationMs: 12.4,
      status: "ok",
      timestamp: "2026-06-18T00:00:01.000Z",
    });

    sink.recordMetric(metric);
    sink.recordSpan(span);

    expect(sink.metrics).toEqual([
      {
        attributes: {
          appId: "app_pdf_reader",
        },
        name: "gateway.tokens",
        timestamp: "2026-06-18T00:00:00.000Z",
        unit: "tokens",
        value: 15,
      },
    ]);
    expect(sink.spans).toEqual([
      {
        attributes: {
          provider: "demo",
          routeId: "route_paper_summary",
        },
        durationMs: 12,
        name: "gateway.adapter.call",
        status: "ok",
        timestamp: "2026-06-18T00:00:01.000Z",
      },
    ]);
  });
});
