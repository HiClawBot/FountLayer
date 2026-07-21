import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

import {
  consoleSessionCookieName,
  isConsoleRequestAuthorized,
  readBearerToken,
  sanitizeConsoleNextPath,
} from "./lib/console-auth";

export async function proxy(request: NextRequest) {
  const authorized = await isConsoleRequestAuthorized({
    accessToken: readBearerToken(request.headers.get("authorization")),
    accessTokenSha256: process.env.CONSOLE_OPERATOR_TOKEN_SHA256,
    sessionSecret: process.env.CONSOLE_SESSION_SECRET,
    sessionToken: request.cookies.get(consoleSessionCookieName)?.value,
  });
  const { pathname, search } = request.nextUrl;

  if (pathname === "/login") {
    if (!authorized) {
      return NextResponse.next();
    }

    return NextResponse.redirect(new URL("/overview", request.url));
  }

  if (authorized) {
    return NextResponse.next();
  }

  const loginUrl = new URL("/login", request.url);
  loginUrl.searchParams.set(
    "next",
    sanitizeConsoleNextPath(`${pathname}${search}`),
  );

  return NextResponse.redirect(loginUrl);
}

export const config = {
  matcher: [
    "/((?!_next|favicon.ico|icon.svg|apple-icon.png|robots.txt|sitemap.xml).*)",
  ],
};
