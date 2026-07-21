"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import {
  consoleSessionCookieName,
  consoleSessionTtlSeconds,
  createConsoleSessionToken,
  sanitizeConsoleNextPath,
  verifyConsoleOperatorToken,
} from "../../lib/console-auth";
import { consoleSessionCookieIsSecure } from "../../lib/console-auth-server";

function formString(formData: FormData, key: string): string {
  const value = formData.get(key);

  return typeof value === "string" ? value.trim() : "";
}

export async function loginConsoleOperator(formData: FormData) {
  const nextPath = sanitizeConsoleNextPath(formString(formData, "next"));
  const valid = await verifyConsoleOperatorToken(
    formString(formData, "operatorToken"),
    process.env.CONSOLE_OPERATOR_TOKEN_SHA256,
  );
  const sessionSecret = process.env.CONSOLE_SESSION_SECRET;

  if (!valid || !sessionSecret) {
    const loginUrl = new URL("http://console.local/login");
    loginUrl.searchParams.set("error", "invalid");
    loginUrl.searchParams.set("next", nextPath);
    redirect(`${loginUrl.pathname}${loginUrl.search}`);
  }

  const sessionToken = await createConsoleSessionToken(sessionSecret);
  const cookieStore = await cookies();
  cookieStore.set(consoleSessionCookieName, sessionToken, {
    httpOnly: true,
    maxAge: consoleSessionTtlSeconds,
    path: "/",
    sameSite: "strict",
    secure: consoleSessionCookieIsSecure(),
  });
  redirect(nextPath);
}

export async function logoutConsoleOperator() {
  const cookieStore = await cookies();
  cookieStore.delete(consoleSessionCookieName);
  redirect("/login");
}
