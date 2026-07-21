/* global Buffer, console, process */

import { createServer } from "node:http";

const host = "127.0.0.1";
const port = Number(process.env.OPENAI_FIXTURE_PORT ?? "3314");
const expectedApiKey =
  process.env.OPENAI_FIXTURE_API_KEY ?? "local-placeholder";
const maxBodyBytes = 256 * 1024;

function sendJson(response, statusCode, body) {
  response.writeHead(statusCode, { "content-type": "application/json" });
  response.end(JSON.stringify(body));
}

async function readJsonBody(request) {
  const chunks = [];
  let received = 0;

  for await (const chunk of request) {
    received += chunk.length;

    if (received > maxBodyBytes) {
      throw new Error("request_too_large");
    }

    chunks.push(Buffer.from(chunk));
  }

  return JSON.parse(Buffer.concat(chunks).toString("utf8"));
}

const server = createServer(async (request, response) => {
  if (request.headers.authorization !== `Bearer ${expectedApiKey}`) {
    sendJson(response, 401, {
      error: { message: "Fixture API key rejected." },
    });
    return;
  }

  if (request.method === "GET" && request.url === "/v1/models") {
    sendJson(response, 200, {
      data: [
        {
          created: 0,
          id: "local-model",
          object: "model",
          owned_by: "fountlayer-fixture",
        },
      ],
      object: "list",
    });
    return;
  }

  if (request.method === "POST" && request.url === "/v1/chat/completions") {
    try {
      const body = await readJsonBody(request);
      const lastUserMessage = Array.isArray(body.messages)
        ? [...body.messages]
            .reverse()
            .find((message) => message?.role === "user")
        : undefined;
      const content = `Fixture summary: ${String(lastUserMessage?.content ?? "").slice(0, 120)}`;

      sendJson(response, 200, {
        choices: [
          {
            finish_reason: "stop",
            index: 0,
            message: { content, role: "assistant" },
          },
        ],
        created: 0,
        id: "chatcmpl_fountlayer_fixture",
        model: typeof body.model === "string" ? body.model : "local-model",
        object: "chat.completion",
        usage: {
          completion_tokens: 8,
          prompt_tokens: 16,
          total_tokens: 24,
        },
      });
    } catch (error) {
      sendJson(response, error?.message === "request_too_large" ? 413 : 400, {
        error: { message: "Fixture request body rejected." },
      });
    }

    return;
  }

  sendJson(response, 404, { error: { message: "Fixture route not found." } });
});

server.listen(port, host, () => {
  console.log(
    JSON.stringify({
      host,
      ok: true,
      port,
      service: "openai-compatible-ci-fixture",
    }),
  );
});

for (const signal of ["SIGINT", "SIGTERM"]) {
  process.once(signal, () => {
    void server.close();
  });
}
