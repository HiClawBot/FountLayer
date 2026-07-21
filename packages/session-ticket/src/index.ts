import {
  attributionContextSchema,
  type AttributionContext,
} from "@fountlayer/protocol";

export const sessionTicketPrefix = "fl_ticket_v1";
export const sessionTicketTtlSeconds = 5 * 60;
export const insecureDevelopmentSessionTicketSecret =
  "change_me_session_ticket_secret_32_bytes_minimum";

export type SessionTicketClaims = {
  attribution: AttributionContext;
  aud: "fountlayer-session";
  exp: number;
  iat: number;
  jti: string;
  v: 1;
};

export type SessionTicketVerification =
  | {
      claims: SessionTicketClaims;
      valid: true;
    }
  | {
      reason: "expired" | "invalid" | "not_yet_valid" | "ttl_exceeded";
      valid: false;
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

function assertSecret(secret: string): void {
  if (secret.length < 32) {
    throw new Error("Session ticket secret must be at least 32 characters.");
  }
}

async function importHmacKey(secret: string): Promise<CryptoKey> {
  assertSecret(secret);

  return crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { hash: "SHA-256", name: "HMAC" },
    false,
    ["sign", "verify"],
  );
}

function parseTicketParts(ticket: string):
  | {
      encodedPayload: string;
      encodedSignature: string;
    }
  | undefined {
  if (ticket.length > 8192) {
    return undefined;
  }

  const parts = ticket.split(".");

  if (
    parts.length !== 3 ||
    parts[0] !== sessionTicketPrefix ||
    !parts[1] ||
    !parts[2]
  ) {
    return undefined;
  }

  return {
    encodedPayload: parts[1],
    encodedSignature: parts[2],
  };
}

function parseClaims(encodedPayload: string): SessionTicketClaims | undefined {
  try {
    const value = JSON.parse(
      decoder.decode(base64UrlToBytes(encodedPayload)),
    ) as Partial<SessionTicketClaims>;
    const attribution = attributionContextSchema.safeParse(value.attribution);

    if (
      value.v !== 1 ||
      value.aud !== "fountlayer-session" ||
      typeof value.jti !== "string" ||
      value.jti.length < 16 ||
      value.jti.length > 256 ||
      typeof value.iat !== "number" ||
      !Number.isInteger(value.iat) ||
      typeof value.exp !== "number" ||
      !Number.isInteger(value.exp) ||
      !attribution.success ||
      Object.values(attribution.data).some((item) => item.length > 256)
    ) {
      return undefined;
    }

    return {
      attribution: attribution.data,
      aud: value.aud,
      exp: value.exp,
      iat: value.iat,
      jti: value.jti,
      v: value.v,
    };
  } catch {
    return undefined;
  }
}

export function decodeSessionTicket(ticket: string): SessionTicketClaims {
  const parts = parseTicketParts(ticket);
  const claims = parts ? parseClaims(parts.encodedPayload) : undefined;

  if (!claims) {
    throw new Error("Session ticket is malformed.");
  }

  return claims;
}

export async function createSessionTicket(input: {
  attribution: AttributionContext;
  nowMs?: number;
  secret: string;
  ticketId?: string;
  ttlSeconds?: number;
}): Promise<string> {
  const attribution = attributionContextSchema.parse(input.attribution);
  const ttlSeconds = input.ttlSeconds ?? sessionTicketTtlSeconds;

  if (
    !Number.isInteger(ttlSeconds) ||
    ttlSeconds < 1 ||
    ttlSeconds > sessionTicketTtlSeconds
  ) {
    throw new Error(
      `Session ticket TTL must be between 1 and ${sessionTicketTtlSeconds} seconds.`,
    );
  }

  if (Object.values(attribution).some((item) => item.length > 256)) {
    throw new Error(
      "Session ticket attribution values must be at most 256 characters.",
    );
  }

  const issuedAt = Math.floor((input.nowMs ?? Date.now()) / 1000);
  const ticketId = input.ticketId ?? crypto.randomUUID();

  if (ticketId.length < 16 || ticketId.length > 256) {
    throw new Error("Session ticket ID must contain 16 to 256 characters.");
  }

  const claims: SessionTicketClaims = {
    attribution,
    aud: "fountlayer-session",
    exp: issuedAt + ttlSeconds,
    iat: issuedAt,
    jti: ticketId,
    v: 1,
  };
  const encodedPayload = bytesToBase64Url(
    encoder.encode(JSON.stringify(claims)),
  );
  const signature = new Uint8Array(
    await crypto.subtle.sign(
      "HMAC",
      await importHmacKey(input.secret),
      encoder.encode(encodedPayload),
    ),
  );

  return `${sessionTicketPrefix}.${encodedPayload}.${bytesToBase64Url(signature)}`;
}

export async function verifySessionTicket(input: {
  nowMs?: number;
  secret: string;
  ticket: string;
}): Promise<SessionTicketVerification> {
  const parts = parseTicketParts(input.ticket);

  if (!parts || input.secret.length < 32) {
    return { reason: "invalid", valid: false };
  }

  try {
    const signatureValid = await crypto.subtle.verify(
      "HMAC",
      await importHmacKey(input.secret),
      base64UrlToBytes(parts.encodedSignature),
      encoder.encode(parts.encodedPayload),
    );

    if (!signatureValid) {
      return { reason: "invalid", valid: false };
    }

    const claims = parseClaims(parts.encodedPayload);

    if (!claims || claims.exp <= claims.iat) {
      return { reason: "invalid", valid: false };
    }

    if (claims.exp - claims.iat > sessionTicketTtlSeconds) {
      return { reason: "ttl_exceeded", valid: false };
    }

    const now = Math.floor((input.nowMs ?? Date.now()) / 1000);

    if (claims.iat > now + 60) {
      return { reason: "not_yet_valid", valid: false };
    }

    if (claims.exp <= now) {
      return { reason: "expired", valid: false };
    }

    return { claims, valid: true };
  } catch {
    return { reason: "invalid", valid: false };
  }
}
