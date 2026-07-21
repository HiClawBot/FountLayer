import { NextRequest } from "next/server";
import { afterEach, describe, expect, it } from "vitest";

import { proxy } from "./proxy";
import {
  consoleSessionCookieName,
  consoleSessionTtlSeconds,
  createConsoleSessionToken,
  isConsoleRequestAuthorized,
  sanitizeConsoleNextPath,
  sha256Hex,
  verifyConsoleOperatorToken,
  verifyConsoleSessionToken,
} from "./lib/console-auth";

const operatorToken = "operator-test-token-with-more-than-32-characters";
const sessionSecret = "session-test-secret-with-more-than-32-characters";

afterEach(() => {
  delete process.env.CONSOLE_OPERATOR_TOKEN_SHA256;
  delete process.env.CONSOLE_SESSION_SECRET;
});

describe("Console operator authentication", () => {
  it("verifies only the configured high-entropy operator token", async () => {
    const digest = await sha256Hex(operatorToken);

    await expect(
      verifyConsoleOperatorToken(operatorToken, digest),
    ).resolves.toBe(true);
    await expect(
      verifyConsoleOperatorToken(`${operatorToken}-wrong`, digest),
    ).resolves.toBe(false);
    await expect(
      verifyConsoleOperatorToken("too-short", await sha256Hex("too-short")),
    ).resolves.toBe(false);
    await expect(
      verifyConsoleOperatorToken(operatorToken, "not-a-sha256-digest"),
    ).resolves.toBe(false);
  });

  it("signs short-lived sessions and rejects tampering or expiry", async () => {
    const now = Date.UTC(2026, 6, 21, 12, 0, 0);
    const token = await createConsoleSessionToken(sessionSecret, now);

    await expect(
      verifyConsoleSessionToken(token, sessionSecret, now),
    ).resolves.toBe(true);
    await expect(
      verifyConsoleSessionToken(`${token}tampered`, sessionSecret, now),
    ).resolves.toBe(false);
    await expect(
      verifyConsoleSessionToken(
        token,
        sessionSecret,
        now + (consoleSessionTtlSeconds + 1) * 1000,
      ),
    ).resolves.toBe(false);
  });

  it("accepts either a valid session or operator bearer token", async () => {
    const digest = await sha256Hex(operatorToken);

    await expect(
      isConsoleRequestAuthorized({
        accessToken: operatorToken,
        accessTokenSha256: digest,
      }),
    ).resolves.toBe(true);
    await expect(
      isConsoleRequestAuthorized({
        sessionSecret,
        sessionToken: await createConsoleSessionToken(sessionSecret),
      }),
    ).resolves.toBe(true);
    await expect(isConsoleRequestAuthorized({})).resolves.toBe(false);
  });

  it("sanitizes post-login destinations", () => {
    expect(sanitizeConsoleNextPath("/usage-ledger?app=demo")).toBe(
      "/usage-ledger?app=demo",
    );
    expect(sanitizeConsoleNextPath("https://attacker.example")).toBe(
      "/overview",
    );
    expect(sanitizeConsoleNextPath("//attacker.example")).toBe("/overview");
    expect(sanitizeConsoleNextPath("/login?next=/setup")).toBe("/overview");
  });

  it("redirects an unauthenticated Console request to login", async () => {
    const response = await proxy(
      new NextRequest("http://localhost:3301/setup?source=test"),
    );

    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe(
      "http://localhost:3301/login?next=%2Fsetup%3Fsource%3Dtest",
    );
  });

  it("allows a valid session through the Console proxy", async () => {
    process.env.CONSOLE_OPERATOR_TOKEN_SHA256 = await sha256Hex(operatorToken);
    process.env.CONSOLE_SESSION_SECRET = sessionSecret;
    const session = await createConsoleSessionToken(sessionSecret);
    const request = new NextRequest("http://localhost:3301/setup", {
      headers: {
        cookie: `${consoleSessionCookieName}=${session}`,
      },
    });
    const response = await proxy(request);

    expect(response.status).toBe(200);
    expect(response.headers.get("x-middleware-next")).toBe("1");
  });
});
