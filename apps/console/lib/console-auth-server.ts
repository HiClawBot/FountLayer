import { cookies, headers } from "next/headers";

import {
  consoleSessionCookieName,
  isConsoleRequestAuthorized,
  readBearerToken,
} from "./console-auth";

export class ConsoleOperatorAuthError extends Error {
  constructor() {
    super("Console operator authentication is required.");
    this.name = "ConsoleOperatorAuthError";
  }
}

export async function requireConsoleOperator(): Promise<void> {
  const [cookieStore, headerStore] = await Promise.all([cookies(), headers()]);
  const authorized = await isConsoleRequestAuthorized({
    accessToken: readBearerToken(headerStore.get("authorization")),
    accessTokenSha256: process.env.CONSOLE_OPERATOR_TOKEN_SHA256,
    sessionSecret: process.env.CONSOLE_SESSION_SECRET,
    sessionToken: cookieStore.get(consoleSessionCookieName)?.value,
  });

  if (!authorized) {
    throw new ConsoleOperatorAuthError();
  }
}

export function consoleSessionCookieIsSecure(): boolean {
  const configured = process.env.CONSOLE_SESSION_COOKIE_SECURE?.trim();

  if (configured === "true") {
    return true;
  }

  if (configured === "false") {
    return false;
  }

  return process.env.NODE_ENV === "production";
}
