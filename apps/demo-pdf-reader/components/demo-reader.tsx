"use client";

import {
  Calculator,
  FileCheck2,
  FileText,
  Send,
  ShieldCheck,
  WalletCards,
} from "lucide-react";
import { useMemo, useState } from "react";

import { createFountLayer } from "@fountlayer/sdk-js";

import {
  documentLimits,
  extractDocument,
  type ExtractedDocument,
} from "../lib/extract-document";

const gatewayEndpoint =
  process.env.NEXT_PUBLIC_GATEWAY_BASE_URL ?? "http://localhost:3300";

export function DemoReader() {
  const mode = "managed" as const;
  const [documentText, setDocumentText] = useState(
    "FountLayer is an open LLM last-mile distribution layer for apps. It routes app-native AI requests through attribution, faucet credits, metering, and balanced ledger entries.",
  );
  const [estimate, setEstimate] = useState<string>("0.00000000");
  const [balance, setBalance] = useState<string>("0.00000000");
  const [summary, setSummary] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [documentInfo, setDocumentInfo] = useState<
    Omit<ExtractedDocument, "text"> | undefined
  >();
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

    setBusy(true);
    setError("");
    setSummary("");

    try {
      const extracted = await extractDocument(file);

      setDocumentText(extracted.text);
      setDocumentInfo({
        characterCount: extracted.characterCount,
        fileName: extracted.fileName,
        kind: extracted.kind,
        pageCount: extracted.pageCount,
      });
      setEstimate("0.00000000");
    } catch (caught) {
      setDocumentInfo(undefined);
      setError(
        caught instanceof Error
          ? caught.message
          : "Document extraction failed.",
      );
    } finally {
      setBusy(false);
    }
  }

  async function startDemoSession() {
    const response = await fetch("/api/session-ticket", { method: "POST" });
    const payload = (await response.json()) as {
      error?: { message?: string };
      ticket?: string;
    };

    if (!response.ok || !payload.ticket) {
      throw new Error(
        payload.error?.message ?? "Session ticket issuer is unavailable.",
      );
    }

    return sdk.startSession({
      ticket: payload.ticket,
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
          <span>Document Reader AI</span>
        </div>
        <div className="mode-status" aria-label="AI access mode">
          Managed beta
        </div>
      </header>
      <main className="content">
        <section className="panel">
          <div className="panel-header">
            <h1>Document</h1>
            <input
              accept=".pdf,.txt,.md,application/pdf,text/plain,text/markdown"
              aria-label="Document file"
              disabled={busy}
              onChange={(event) => void loadFile(event.target.files?.[0])}
              type="file"
            />
          </div>
          <div className="panel-body">
            <div className="privacy-note">
              <ShieldCheck size={17} aria-hidden="true" />
              <span>
                PDF parsing stays in this browser. Only bounded extracted text
                is sent when you estimate or summarize.
              </span>
            </div>
            {documentInfo ? (
              <div className="document-status" aria-live="polite">
                <FileCheck2 size={17} aria-hidden="true" />
                <span>
                  <strong>{documentInfo.fileName}</strong> · {documentInfo.kind}
                  {documentInfo.pageCount
                    ? ` · ${documentInfo.pageCount} pages`
                    : ""}
                  {` · ${documentInfo.characterCount.toLocaleString()} characters`}
                </span>
              </div>
            ) : null}
            <textarea
              aria-label="Document text"
              maxLength={documentLimits.maxCharacters}
              onChange={(event) => {
                setDocumentText(event.target.value);
                setDocumentInfo(undefined);
                setSummary("");
                setEstimate("0.00000000");
              }}
              value={documentText}
            />
            <div className="limit-note">
              PDF limit: {documentLimits.maxPdfPages} pages /{" "}
              {documentLimits.maxBytes / 1024 / 1024} MB · Text limit:{" "}
              {documentLimits.maxCharacters.toLocaleString()} characters
            </div>
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
