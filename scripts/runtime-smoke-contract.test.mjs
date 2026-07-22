import { describe, expect, it } from "vitest";

import {
  inspectRuntimeSmokeArguments,
  inspectStagingSmokeConfiguration,
  reconcileSmokeBilling,
} from "./runtime-smoke-contract.mjs";

const usageEventId = "ue_golden";

function successfulInput() {
  return {
    billing: {
      ledger_entry_count: 4,
      retail_price: "0.00000937",
      upstream_cost: "0.00000450",
      usage_event_id: usageEventId,
    },
    ledgerEntries: [
      {
        amount: "0.00000937",
        direction: "debit",
        reason: "retail_charge",
        usageEventId,
      },
      {
        amount: "0.00000937",
        direction: "credit",
        reason: "platform_revenue",
        usageEventId,
      },
      {
        amount: "0.00000450",
        direction: "debit",
        reason: "provider_cost",
        usageEventId,
      },
      {
        amount: "0.00000450",
        direction: "credit",
        reason: "provider_payable",
        usageEventId,
      },
    ],
    usageEvents: [
      {
        id: usageEventId,
        inputTokens: 10,
        outputTokens: 5,
        provider: "openai-compatible",
        retailPrice: "0.00000937",
        status: "success",
        upstreamCost: "0.00000450",
        usageEstimated: false,
      },
    ],
  };
}

describe("runtime smoke contract", () => {
  it("rejects unknown arguments without echoing their values", () => {
    const sensitiveArgument = "--token=do-not-print-this-value";
    const report = inspectRuntimeSmokeArguments([sensitiveArgument]);

    expect(report).toEqual({
      issues: [
        {
          id: "runtime.arguments",
          message: "The runtime smoke command received an unsupported option.",
          remediation: "Run without options or use only --staging.",
        },
      ],
      ok: false,
      stagingProfile: false,
    });
    expect(JSON.stringify(report)).not.toContain(sensitiveArgument);
  });

  it("accepts explicit secret-safe TLS staging configuration", () => {
    const report = inspectStagingSmokeConfiguration({
      adminToken: "admin-" + "a".repeat(32),
      checkConsole: true,
      consoleBaseUrl: "https://console.staging.example.test",
      consoleOperatorToken: "operator-" + "b".repeat(32),
      gatewayBaseUrl: "https://gateway.staging.example.test",
      sessionTicketSecret: "ticket-" + "c".repeat(32),
    });

    expect(report).toEqual({
      issues: [],
      ok: true,
      profile: "credentialed-staging",
    });
  });

  it("reports only fixed issue metadata for unsafe staging configuration", () => {
    const secret = "change_me_secret_value";
    const report = inspectStagingSmokeConfiguration({
      adminToken: secret,
      checkConsole: true,
      consoleBaseUrl: "http://localhost:3301",
      consoleOperatorToken: secret,
      gatewayBaseUrl: "http://localhost:3300",
      sessionTicketSecret: secret,
    });

    expect(report.ok).toBe(false);
    expect(report.issues.map((item) => item.id)).toEqual([
      "staging.gateway-url",
      "staging.admin-token",
      "staging.ticket-secret",
      "staging.console-url",
      "staging.console-token",
    ]);
    expect(JSON.stringify(report)).not.toContain(secret);
  });

  it("does not allow the golden profile to skip Console verification", () => {
    const report = inspectStagingSmokeConfiguration({
      adminToken: "admin-" + "a".repeat(32),
      checkConsole: false,
      consoleBaseUrl: "https://console.staging.example.test",
      consoleOperatorToken: "operator-" + "b".repeat(32),
      gatewayBaseUrl: "https://gateway.staging.example.test",
      sessionTicketSecret: "ticket-" + "c".repeat(32),
    });

    expect(report.issues.map((item) => item.id)).toEqual([
      "staging.console-check",
    ]);
  });

  it("reconciles one provider-supplied usage event and its exact ledger", () => {
    const input = successfulInput();
    input.usageEvents.unshift({ id: "ue_unrelated" });
    input.ledgerEntries.unshift({
      amount: "5.00000000",
      direction: "debit",
      reason: "unrelated",
      usageEventId: "ue_unrelated",
    });

    expect(reconcileSmokeBilling(input)).toEqual({
      credits: "0.00001387",
      debits: "0.00001387",
      inputTokens: 10,
      ledgerEntries: 4,
      outputTokens: 5,
      provider: "openai-compatible",
      retailPrice: "0.00000937",
      upstreamCost: "0.00000450",
      usageEstimated: false,
      usageEventId,
    });
  });

  it("rejects estimated provider usage", () => {
    const input = successfulInput();
    input.usageEvents[0].usageEstimated = true;

    expect(() => reconcileSmokeBilling(input)).toThrow(
      "provider-supplied usage",
    );
  });

  it("rejects an unbalanced exact ledger", () => {
    const input = successfulInput();
    input.ledgerEntries[1].amount = "0.00000936";

    expect(() => reconcileSmokeBilling(input)).toThrow("not balanced");
  });
});
