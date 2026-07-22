import { Buffer } from "node:buffer";
import { createHash } from "node:crypto";

import { describe, expect, it } from "vitest";

import {
  formatDoctorReport,
  inspectBetaDoctor,
  parseEnvFileText,
} from "./beta-doctor.mjs";

const commit = "8".repeat(40);
const adminToken = "admin-token-" + "a".repeat(32);

function readyEnv() {
  return {
    CONSOLE_GATEWAY_ADMIN_TOKEN: adminToken,
    CONSOLE_OPERATOR_TOKEN_SHA256: "b".repeat(64),
    CONSOLE_SESSION_COOKIE_SECURE: "true",
    CONSOLE_SESSION_SECRET: "console-session-" + "c".repeat(32),
    DATABASE_URL:
      "postgres://fountlayer:encoded-password@postgres:5432/fountlayer",
    FOUNTLAYER_ADMIN_TOKEN_SHA256: createHash("sha256")
      .update(adminToken)
      .digest("hex"),
    FOUNTLAYER_CREDENTIAL_KEY_VERSION: "beta-v1",
    FOUNTLAYER_CREDENTIAL_MASTER_KEY: `base64:${Buffer.alloc(32, 9).toString("base64")}`,
    FOUNTLAYER_IMAGE_TAG: "0.5.0-beta.2",
    FOUNTLAYER_SESSION_TICKET_SECRET: "ticket-secret-" + "d".repeat(32),
    FOUNTLAYER_VCS_REF: commit,
    LITELLM_MASTER_KEY: "litellm-master-" + "e".repeat(32),
    NEXT_PUBLIC_GATEWAY_BASE_URL: "https://gateway.example.test",
    POSTGRES_DB: "fountlayer",
    POSTGRES_PASSWORD: "postgres-password-" + "f".repeat(24),
    POSTGRES_USER: "fountlayer",
    UPSTREAM_OPENAI_API_KEY: "provider-key-" + "g".repeat(32),
    UPSTREAM_OPENAI_BASE_URL: "https://provider.example.test/v1",
    UPSTREAM_OPENAI_MODEL: "provider/model",
  };
}

function readyFacts(overrides = {}) {
  return {
    composeAvailable: true,
    composeConfigValid: true,
    currentCommit: commit,
    dockerAvailable: true,
    env: readyEnv(),
    envFile: ".env.production",
    envFileError: false,
    envFileExists: true,
    envFilePrivate: true,
    installedPnpmVersion: "10.32.1",
    nodeVersion: "v22.23.1",
    packageVersion: "0.5.0-beta.2",
    requiredPnpmVersion: "10.32.1",
    ...overrides,
  };
}

describe("beta doctor", () => {
  it("accepts a complete production-shaped configuration", () => {
    const report = inspectBetaDoctor(readyFacts());

    expect(report.ok).toBe(true);
    expect(report.summary.fail).toBe(0);
    expect(report.checks.every((item) => item.status === "pass")).toBe(true);
  });

  it("reports stable blockers for placeholders and mismatched admin auth", () => {
    const env = readyEnv();
    env.UPSTREAM_OPENAI_API_KEY = "replace_with_upstream_provider_key";
    env.FOUNTLAYER_ADMIN_TOKEN_SHA256 = "0".repeat(64);

    const report = inspectBetaDoctor(readyFacts({ env }));
    const failedIds = report.checks
      .filter((item) => item.status === "fail")
      .map((item) => item.id);

    expect(report.ok).toBe(false);
    expect(failedIds).toContain("config.required-values");
    expect(failedIds).toContain("config.admin-token-pair");
  });

  it("never includes configured secret values in text or JSON output", () => {
    const facts = readyFacts();
    const report = inspectBetaDoctor(facts);
    const outputs = [formatDoctorReport(report), JSON.stringify(report)];

    for (const secret of [
      facts.env.CONSOLE_GATEWAY_ADMIN_TOKEN,
      facts.env.CONSOLE_SESSION_SECRET,
      facts.env.FOUNTLAYER_CREDENTIAL_MASTER_KEY,
      facts.env.FOUNTLAYER_SESSION_TICKET_SECRET,
      facts.env.LITELLM_MASTER_KEY,
      facts.env.POSTGRES_PASSWORD,
      facts.env.UPSTREAM_OPENAI_API_KEY,
    ]) {
      expect(outputs.every((output) => !output.includes(secret))).toBe(true);
    }
  });

  it("reports root causes before dependent configuration checks", () => {
    const report = inspectBetaDoctor(
      readyFacts({
        composeConfigValid: undefined,
        env: {},
        envFileExists: false,
        envFilePrivate: false,
      }),
    );
    const checkIds = report.checks.map((item) => item.id);

    expect(report.ok).toBe(false);
    expect(checkIds).toContain("config.env-file");
    expect(checkIds).not.toContain("config.required-values");
    expect(checkIds).not.toContain("config.admin-token-pair");
  });

  it("parses standard env assignments without evaluating shell syntax", () => {
    expect(
      parseEnvFileText(
        [
          "# comment",
          "PLAIN=value",
          "export QUOTED='value with spaces' # ignored",
          'ESCAPED="line\\nvalue"',
          "COMMENTED=value # ignored",
        ].join("\n"),
      ),
    ).toEqual({
      COMMENTED: "value",
      ESCAPED: "line\nvalue",
      PLAIN: "value",
      QUOTED: "value with spaces",
    });
    expect(() => parseEnvFileText("VALID=value\nnot valid")).toThrow("line 2");
  });
});
