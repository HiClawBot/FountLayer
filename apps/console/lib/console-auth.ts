export const consoleSessionCookieName = "fl_console_session";
export const consoleSessionTtlSeconds = 8 * 60 * 60;

type ConsoleSessionPayload = {
  exp: number;
  iat: number;
  sub: "operator";
  v: 1;
};

const encoder = new TextEncoder();
const decoder = new TextDecoder();

function bytesToBase64Url(value: Uint8Array): string {
  let binary = "";

  for (const byte of value) {
    binary += String.fromCharCode(byte);
  }

  return btoa(binary)
    .replaceAll("+", "-")
    .replaceAll("/", "_")
    .replace(/=+$/u, "");
}

function base64UrlToBytes(value: string): Uint8Array<ArrayBuffer> {
  const normalized = value.replaceAll("-", "+").replaceAll("_", "/");
  const padding = "=".repeat((4 - (normalized.length % 4)) % 4);
  const binary = atob(`${normalized}${padding}`);
  const bytes = new Uint8Array(new ArrayBuffer(binary.length));

  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }

  return bytes;
}

function isValidSessionSecret(secret: string | undefined): secret is string {
  return typeof secret === "string" && secret.length >= 32;
}

function constantTimeEqual(left: string, right: string): boolean {
  const length = Math.max(left.length, right.length);
  let difference = left.length ^ right.length;

  for (let index = 0; index < length; index += 1) {
    difference |=
      (left.charCodeAt(index) || 0) ^ (right.charCodeAt(index) || 0);
  }

  return difference === 0;
}

async function importHmacKey(secret: string): Promise<CryptoKey> {
  if (!isValidSessionSecret(secret)) {
    throw new Error("Console session secret must be at least 32 characters.");
  }

  return crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { hash: "SHA-256", name: "HMAC" },
    false,
    ["sign", "verify"],
  );
}

export async function sha256Hex(value: string): Promise<string> {
  const digest = new Uint8Array(
    await crypto.subtle.digest("SHA-256", encoder.encode(value)),
  );

  return Array.from(digest, (byte) => byte.toString(16).padStart(2, "0")).join(
    "",
  );
}

export async function verifyConsoleOperatorToken(
  candidate: string | undefined,
  expectedSha256: string | undefined,
): Promise<boolean> {
  const normalizedCandidate = candidate?.trim() ?? "";
  const normalizedExpected = expectedSha256?.trim().toLowerCase() ?? "";

  if (
    normalizedCandidate.length < 32 ||
    !/^[a-f0-9]{64}$/u.test(normalizedExpected)
  ) {
    return false;
  }

  return constantTimeEqual(
    await sha256Hex(normalizedCandidate),
    normalizedExpected,
  );
}

export async function createConsoleSessionToken(
  secret: string,
  nowMs = Date.now(),
): Promise<string> {
  const issuedAt = Math.floor(nowMs / 1000);
  const payload: ConsoleSessionPayload = {
    exp: issuedAt + consoleSessionTtlSeconds,
    iat: issuedAt,
    sub: "operator",
    v: 1,
  };
  const encodedPayload = bytesToBase64Url(
    encoder.encode(JSON.stringify(payload)),
  );
  const signature = new Uint8Array(
    await crypto.subtle.sign(
      "HMAC",
      await importHmacKey(secret),
      encoder.encode(encodedPayload),
    ),
  );

  return `${encodedPayload}.${bytesToBase64Url(signature)}`;
}

export async function verifyConsoleSessionToken(
  token: string | undefined,
  secret: string | undefined,
  nowMs = Date.now(),
): Promise<boolean> {
  if (!token || !isValidSessionSecret(secret)) {
    return false;
  }

  const parts = token.split(".");

  if (parts.length !== 2) {
    return false;
  }

  const [encodedPayload, encodedSignature] = parts;

  if (!encodedPayload || !encodedSignature) {
    return false;
  }

  try {
    const validSignature = await crypto.subtle.verify(
      "HMAC",
      await importHmacKey(secret),
      base64UrlToBytes(encodedSignature),
      encoder.encode(encodedPayload),
    );

    if (!validSignature) {
      return false;
    }

    const payload = JSON.parse(
      decoder.decode(base64UrlToBytes(encodedPayload)),
    ) as Partial<ConsoleSessionPayload>;
    const now = Math.floor(nowMs / 1000);

    return (
      payload.v === 1 &&
      payload.sub === "operator" &&
      typeof payload.iat === "number" &&
      typeof payload.exp === "number" &&
      payload.iat <= now + 60 &&
      payload.exp > payload.iat &&
      payload.exp > now
    );
  } catch {
    return false;
  }
}

export function readBearerToken(value: string | null | undefined) {
  const match = /^Bearer\s+(.+)$/iu.exec(value?.trim() ?? "");

  return match?.[1]?.trim();
}

export async function isConsoleRequestAuthorized(input: {
  accessToken?: string;
  accessTokenSha256?: string;
  sessionSecret?: string;
  sessionToken?: string;
  nowMs?: number;
}): Promise<boolean> {
  const [sessionAuthorized, accessTokenAuthorized] = await Promise.all([
    verifyConsoleSessionToken(
      input.sessionToken,
      input.sessionSecret,
      input.nowMs,
    ),
    verifyConsoleOperatorToken(input.accessToken, input.accessTokenSha256),
  ]);

  return sessionAuthorized || accessTokenAuthorized;
}

export function sanitizeConsoleNextPath(value: string | undefined): string {
  if (
    !value ||
    !value.startsWith("/") ||
    value.startsWith("//") ||
    value.startsWith("/login")
  ) {
    return "/overview";
  }

  return value;
}
