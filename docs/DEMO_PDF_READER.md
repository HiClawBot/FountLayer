# Demo: PDF Reader AI

The first demo should be vertical, not generic chat.

## Goals

- Prove that a normal app can embed FountLayer.
- Prove faucet credits can fund first use.
- Prove token flow and money flow can be attributed to app/channel/use-case.
- Prove users can switch among managed, BYOK, and local modes.

## Features

1. Paste text or upload PDF.
2. Summarize document.
3. Extract outline.
4. Ask question about document.
5. Show estimated cost before running.
6. Show faucet balance after running.
7. Show current mode.
8. Allow local endpoint configuration.
9. Allow BYOK local-only configuration.

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
- Switching to local endpoint works with OpenAI-compatible server.
