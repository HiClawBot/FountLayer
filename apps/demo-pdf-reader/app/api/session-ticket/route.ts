import {
  createSessionTicket,
  insecureDevelopmentSessionTicketSecret,
  sessionTicketTtlSeconds,
} from "@fountlayer/session-ticket";

const attribution = {
  appId: "app_pdf_reader",
  channelId: "channel_desktop",
  endUserId: "user_hash_123",
  mode: "managed" as const,
  useCase: "paper_summary",
};

export async function POST() {
  const configuredSecret = process.env.FOUNTLAYER_SESSION_TICKET_SECRET?.trim();

  if (!configuredSecret && process.env.NODE_ENV === "production") {
    return Response.json(
      { error: { message: "Session ticket issuer is not configured." } },
      { status: 503 },
    );
  }

  const now = Date.now();
  const ticket = await createSessionTicket({
    attribution,
    nowMs: now,
    secret: configuredSecret ?? insecureDevelopmentSessionTicketSecret,
  });

  return Response.json(
    {
      expires_at: new Date(now + sessionTicketTtlSeconds * 1000).toISOString(),
      ticket,
    },
    {
      headers: {
        "cache-control": "no-store",
      },
    },
  );
}
