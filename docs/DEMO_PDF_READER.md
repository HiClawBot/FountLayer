# Demo: Document Reader AI

External beta status: managed-mode text, Markdown, and bounded PDF documents. PDF.js
runs locally in the browser with a 10 MB file limit, a 40-page limit, and an 80,000
extracted-character limit. Raw PDF bytes are never sent to the Gateway; only the
visible extracted text is submitted when the user estimates or summarizes. Encrypted,
damaged, image-only, empty, oversized, over-page, and unsupported documents fail closed
with a user-visible error. BYOK/local mode controls remain hidden because those SDK
settings do not participate in the stock request path.

The first demo should be vertical, not generic chat.

## Goals

- Prove that a normal app can embed FountLayer.
- Prove faucet credits can fund first use.
- Prove token flow and money flow can be attributed to app/channel/use-case.
- Prove the managed non-streaming path before exposing additional modes.

## Features

1. Paste text or upload PDF, plain text, or Markdown with visible limits and metadata.
2. Summarize document.
3. Extract outline.
4. Ask question about document.
5. Show estimated cost before running.
6. Show faucet balance after running.
7. Show managed mode as the beta execution contract.
8. Add local endpoint configuration only after the local request path is real.
9. Add BYOK controls only after a local-only request path is real.

## Example Use Case

```txt
App: app_pdf_reader
Channel: channel_desktop
Use case: paper_summary
Mode: managed
Route: vertical/paper-summary
Payment: faucet_grant
```

## Success Criteria

- New user runs one summary using faucet credits.
- Console shows usage event.
- Ledger entries balance.
- A committed real-PDF fixture passes PDF.js extraction tests and the browser upload
  flow.
- Raw PDF bytes remain in the browser; only bounded extracted text reaches the Gateway.
- Unsupported and out-of-bounds documents fail before session creation or inference.
- Unsupported local/BYOK controls are absent from the beta demo.
