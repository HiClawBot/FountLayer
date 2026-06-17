import { createFountLayer } from "@fountlayer/sdk-js";

const ai = createFountLayer({
  appId: "app_pdf_reader",
  channelId: "channel_desktop",
  endpoint: "https://gateway.example.com",
});

const session = await ai.startSession({
  endUserId: "user_hash_123",
  useCase: "paper_summary",
  mode: "managed",
});

const estimate = await session.getEstimatedCost({
  model: "vertical/paper-summary",
  messages: [{ role: "user", content: "Summarize this document." }],
});

console.log("Estimated price", estimate.retail_price, estimate.currency);

const result = await session.chat({
  model: "vertical/paper-summary",
  messages: [{ role: "user", content: "Summarize this document." }],
});

console.log(result.choices[0]?.message.content);
console.log(result.billing);
