# Demo: Document Reader AI

External beta status: managed-mode plain-text/Markdown documents only. Real PDF
extraction is a release blocker and PDF files are intentionally not accepted until a
bounded parser and fixture-based browser tests land. BYOK/local mode controls are also
hidden because those SDK settings do not participate in the stock request path.

The first demo should be vertical, not generic chat.

## Goals

- Prove that a normal app can embed FountLayer.
- Prove faucet credits can fund first use.
- Prove token flow and money flow can be attributed to app/channel/use-case.
- Prove the managed non-streaming path before exposing additional modes.

## Features

1. Paste text or upload plain text/Markdown. Add PDF only after bounded extraction lands.
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
- Plain-text/Markdown upload never attempts to decode binary PDF bytes.
- Unsupported local/BYOK controls are absent from the beta demo.
