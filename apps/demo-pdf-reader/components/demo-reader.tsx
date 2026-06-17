"use client";

import { Calculator, FileText, Send, WalletCards } from "lucide-react";
import { useMemo, useState } from "react";

import { createFountLayer, type FountLayerMode } from "@fountlayer/sdk-js";

const gatewayEndpoint =
  process.env.NEXT_PUBLIC_GATEWAY_BASE_URL ?? "http://localhost:8787";

const modes: FountLayerMode[] = ["managed", "byok", "local"];

export function DemoReader() {
  const [mode, setMode] = useState<FountLayerMode>("managed");
  const [documentText, setDocumentText] = useState(
    "FountLayer is an open LLM last-mile distribution layer for apps. It routes app-native AI requests through attribution, faucet credits, metering, and balanced ledger entries.",
  );
  const [apiKey, setApiKey] = useState("");
  const [localEndpoint, setLocalEndpoint] = useState(
    "http://127.0.0.1:11434/v1",
  );
  const [estimate, setEstimate] = useState<string>("0.00000000");
  const [balance, setBalance] = useState<string>("0.00000000");
  const [summary, setSummary] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const sdk = useMemo(
    () =>
      createFountLayer({
        appId: "app_pdf_reader",
        channelId: "channel_desktop",
        endpoint: gatewayEndpoint,
      }),
    [],
  );

  async function loadFile(file: File | undefined): Promise<void> {
    if (!file) {
      return;
    }

    if (
      file.type === "application/pdf" ||
      file.name.toLowerCase().endsWith(".pdf")
    ) {
      setDocumentText(
        `PDF: ${file.name}\nSize: ${file.size} bytes\n\n${await file.text()}`,
      );
      return;
    }

    setDocumentText(await file.text());
  }

  async function startDemoSession() {
    if (mode === "byok" && apiKey) {
      sdk.setUserApiKey(apiKey);
    }

    if (mode === "local") {
      sdk.setLocalEndpoint({
        baseUrl: localEndpoint,
      });
    }

    return sdk.startSession({
      endUserId: "user_hash_123",
      useCase: "paper_summary",
      mode,
    });
  }

  async function refreshEstimateAndBalance(): Promise<void> {
    setBusy(true);
    setError("");

    try {
      const session = await startDemoSession();
      const [nextEstimate, nextBalance] = await Promise.all([
        session.getEstimatedCost({
          model: "vertical/paper-summary",
          messages: [{ role: "user", content: documentText }],
        }),
        session.getBalance(),
      ]);

      setEstimate(nextEstimate.retail_price);
      setBalance(nextBalance.faucet_balance);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Request failed.");
    } finally {
      setBusy(false);
    }
  }

  async function summarize(): Promise<void> {
    setBusy(true);
    setError("");

    try {
      const session = await startDemoSession();
      const result = await session.chat({
        model: "vertical/paper-summary",
        messages: [
          {
            role: "user",
            content: `Summarize this document:\n\n${documentText}`,
          },
        ],
      });

      setSummary(result.choices[0]?.message.content ?? "");
      setEstimate(result.billing.retail_price);
      setBalance(result.billing.faucet_remaining ?? balance);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Request failed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="workspace">
      <header className="topbar">
        <div className="brand">
          <FileText size={22} aria-hidden="true" />
          <span>PDF Reader AI</span>
        </div>
        <div className="mode-switch" aria-label="AI access mode">
          {modes.map((item) => (
            <button
              className={item === mode ? "active" : ""}
              key={item}
              onClick={() => setMode(item)}
              type="button"
            >
              {item}
            </button>
          ))}
        </div>
      </header>
      <main className="content">
        <section className="panel">
          <div className="panel-header">
            <h1>Document</h1>
            <input
              accept=".txt,.md,.pdf,application/pdf,text/*"
              aria-label="Document file"
              onChange={(event) => void loadFile(event.target.files?.[0])}
              type="file"
            />
          </div>
          <div className="panel-body">
            <textarea
              aria-label="Document text"
              onChange={(event) => setDocumentText(event.target.value)}
              value={documentText}
            />
            {mode === "byok" ? (
              <div className="input-row">
                <label htmlFor="byok">BYOK key</label>
                <input
                  id="byok"
                  onChange={(event) => setApiKey(event.target.value)}
                  placeholder="Stored locally"
                  type="password"
                  value={apiKey}
                />
              </div>
            ) : null}
            {mode === "local" ? (
              <div className="input-row">
                <label htmlFor="local-endpoint">Local endpoint</label>
                <input
                  id="local-endpoint"
                  onChange={(event) => setLocalEndpoint(event.target.value)}
                  value={localEndpoint}
                />
              </div>
            ) : null}
            <div className="row">
              <button
                className="button secondary"
                disabled={busy}
                onClick={() => void refreshEstimateAndBalance()}
                type="button"
              >
                <Calculator size={17} aria-hidden="true" />
                Estimate
              </button>
              <button
                className="button"
                disabled={busy || documentText.trim().length === 0}
                onClick={() => void summarize()}
                type="button"
              >
                <Send size={17} aria-hidden="true" />
                Summarize
              </button>
            </div>
            {error ? <div className="error">{error}</div> : null}
          </div>
        </section>
        <aside className="panel">
          <div className="panel-header">
            <h2>Metering</h2>
            <WalletCards size={19} aria-hidden="true" />
          </div>
          <div className="panel-body">
            <div className="stat-list">
              <div className="stat">
                <span>Mode</span>
                <strong>{mode}</strong>
              </div>
              <div className="stat">
                <span>Estimate</span>
                <strong className="mono">${estimate}</strong>
              </div>
              <div className="stat">
                <span>Faucet</span>
                <strong className="mono">${balance}</strong>
              </div>
              <div className="stat">
                <span>App</span>
                <strong className="mono">app_pdf_reader</strong>
              </div>
              <div className="stat">
                <span>Channel</span>
                <strong className="mono">channel_desktop</strong>
              </div>
            </div>
            <div className="summary">{summary || "No summary yet."}</div>
          </div>
        </aside>
      </main>
    </div>
  );
}
