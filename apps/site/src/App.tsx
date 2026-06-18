import {
  Activity,
  ArrowRight,
  BookOpen,
  CircuitBoard,
  Code,
  Database,
  FileText,
  GitBranch,
  KeyRound,
  Play,
  RefreshCcw,
  Route,
  ShieldCheck,
  Wallet,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";

import systemMapUrl from "./assets/fountlayer-system-map.png";

type ScenarioStep = {
  detail: string;
  label: string;
  metric: string;
};

type LedgerRow = {
  amount: string;
  direction: "credit" | "debit";
  reason: string;
  wallet: string;
};

type Scenario = {
  channel: string;
  description: string;
  event: {
    appId: string;
    mode: string;
    retail: string;
    useCase: string;
  };
  ledger: LedgerRow[];
  name: string;
  outcome: string;
  steps: ScenarioStep[];
};

const scenarios = [
  {
    channel: "Desktop reader channel",
    description:
      "An app gives new readers sponsored summaries while FountLayer attributes cost, usage, and remaining faucet balance.",
    event: {
      appId: "marginnote_reader",
      mode: "managed",
      retail: "$0.0034",
      useCase: "paper_summary",
    },
    ledger: [
      {
        amount: "$0.0034",
        direction: "debit",
        reason: "retail_charge",
        wallet: "wallet_faucet_new_reader",
      },
      {
        amount: "$0.0034",
        direction: "credit",
        reason: "platform_revenue",
        wallet: "wallet_platform_revenue",
      },
      {
        amount: "$0.0021",
        direction: "debit",
        reason: "provider_cost",
        wallet: "wallet_platform_cost",
      },
      {
        amount: "$0.0021",
        direction: "credit",
        reason: "provider_payable",
        wallet: "wallet_provider_payable",
      },
    ],
    name: "PDF Reader faucet",
    outcome: "1 usage event, 4 ledger entries, remaining grant $0.9966",
    steps: [
      {
        detail: "SDK sends app, channel, end user, use case, and mode.",
        label: "SDK attribution",
        metric: "5 fields",
      },
      {
        detail: "Gateway resolves the paper-summary route and price.",
        label: "Route and estimate",
        metric: "$0.0034",
      },
      {
        detail:
          "Faucet grant passes model allowlist, use-case cap, and expiry.",
        label: "Faucet check",
        metric: "active",
      },
      {
        detail: "Adapter returns usage without exposing provider keys.",
        label: "Adapter call",
        metric: "demo-local",
      },
      {
        detail: "Usage and ledger records are written once.",
        label: "Meter and ledger",
        metric: "1 + 4",
      },
    ],
  },
  {
    channel: "Embedded helpdesk plugin",
    description:
      "A SaaS vendor funds support answers but keeps spend, routing, and attribution outside the customer-facing app.",
    event: {
      appId: "helio_support",
      mode: "developer_key",
      retail: "$0.0187",
      useCase: "support_answer",
    },
    ledger: [
      {
        amount: "$0.0187",
        direction: "debit",
        reason: "retail_charge",
        wallet: "wallet_developer_campaign",
      },
      {
        amount: "$0.0131",
        direction: "credit",
        reason: "developer_margin",
        wallet: "wallet_helio_support",
      },
      {
        amount: "$0.0039",
        direction: "credit",
        reason: "channel_commission",
        wallet: "wallet_helpdesk_partner",
      },
      {
        amount: "$0.0017",
        direction: "credit",
        reason: "platform_revenue",
        wallet: "wallet_platform_revenue",
      },
    ],
    name: "SaaS plugin channel",
    outcome: "Attribution separates app spend from channel commission.",
    steps: [
      {
        detail: "Plugin starts a scoped session for one support workflow.",
        label: "Scoped session",
        metric: "24h",
      },
      {
        detail: "Gateway picks a route policy with a max retail price.",
        label: "Spend guard",
        metric: "$0.025 cap",
      },
      {
        detail: "Developer credential stays server-side encrypted.",
        label: "Credential boundary",
        metric: "server only",
      },
      {
        detail: "A successful answer becomes a usage event.",
        label: "Usage event",
        metric: "success",
      },
      {
        detail: "Partner commission and revenue are posted to ledger wallets.",
        label: "Settlement-ready",
        metric: "balanced",
      },
    ],
  },
  {
    channel: "Local workstation",
    description:
      "Power users can point the SDK at a local model endpoint while FountLayer still preserves attribution and UX.",
    event: {
      appId: "private_research_desk",
      mode: "local",
      retail: "$0.0000",
      useCase: "private_notes",
    },
    ledger: [
      {
        amount: "$0.0000",
        direction: "debit",
        reason: "local_execution",
        wallet: "wallet_local_user",
      },
      {
        amount: "$0.0000",
        direction: "credit",
        reason: "local_execution",
        wallet: "wallet_local_model",
      },
    ],
    name: "Local or BYOK",
    outcome: "No hosted provider key enters frontend, logs, or Git history.",
    steps: [
      {
        detail: "SDK stores local endpoint settings on the device.",
        label: "Local config",
        metric: "device",
      },
      {
        detail:
          "Gateway rejects hosted end-user BYOK unless explicitly opted in.",
        label: "BYOK boundary",
        metric: "opt-in",
      },
      {
        detail: "Request metadata remains attribution-only.",
        label: "Metadata only",
        metric: "no prompt logs",
      },
      {
        detail: "Privacy hooks can tombstone app-owned end-user identifiers.",
        label: "Retention",
        metric: "tombstone",
      },
      {
        detail: "Operators still see usage shape without private content.",
        label: "Console",
        metric: "visible",
      },
    ],
  },
] satisfies readonly [Scenario, ...Scenario[]];

const invariants = [
  "Provider keys never ship to SDK, frontend, mobile apps, logs, or Git history.",
  "Every LLM request carries app, channel, end user, use case, and mode.",
  "Every successful billable call writes one usage event.",
  "Every money movement writes balanced ledger entries.",
  "Faucet grants include balance, allowlists, daily cap, and expiration.",
];

const capabilities = [
  {
    icon: Route,
    label: "Route policies",
    text: "Logical model aliases map to server-side provider models, allowlists, and spend caps.",
  },
  {
    icon: Wallet,
    label: "Faucet and wallet",
    text: "Faucet grants pay first; wallets can fund billable calls without negative balances.",
  },
  {
    icon: Activity,
    label: "Metadata observability",
    text: "Events, spans, and metrics expose cost and routing shape without prompts or outputs.",
  },
  {
    icon: GitBranch,
    label: "Settlement exports",
    text: "Ledger-period reports produce deterministic CSV files and reconciliation hashes.",
  },
];

export function App() {
  const [activeScenario, setActiveScenario] = useState(0);
  const [activeStep, setActiveStep] = useState(0);
  const [isRunning, setIsRunning] = useState(false);
  const timerRef = useRef<ReturnType<typeof globalThis.setTimeout> | undefined>(
    undefined,
  );
  const scenario = scenarios[activeScenario] ?? scenarios[0];
  const visibleSteps = scenario.steps.slice(0, activeStep + 1);
  const isComplete = activeStep === scenario.steps.length - 1;

  useEffect(
    () => () => {
      if (timerRef.current) {
        globalThis.clearTimeout(timerRef.current);
      }
    },
    [],
  );

  function selectScenario(index: number) {
    setActiveScenario(index);
    setActiveStep(0);
    setIsRunning(false);
  }

  function runNextStep() {
    if (isRunning) {
      return;
    }

    setIsRunning(true);
    timerRef.current = globalThis.setTimeout(() => {
      setActiveStep((current) =>
        current >= scenario.steps.length - 1 ? 0 : current + 1,
      );
      setIsRunning(false);
    }, 420);
  }

  function resetLoop() {
    setActiveStep(0);
    setIsRunning(false);
  }

  return (
    <div className="site-shell">
      <header className="topbar" aria-label="Primary navigation">
        <a className="brand-mark" href="#top" aria-label="FountLayer home">
          <span className="brand-symbol">FL</span>
          <span>FountLayer</span>
        </a>
        <nav className="nav-links" aria-label="Page sections">
          <a href="#loop">Loop</a>
          <a href="#scenarios">Scenarios</a>
          <a href="#security">Security</a>
          <a href="#deploy">Pages</a>
        </nav>
        <a
          className="nav-action"
          href="https://github.com/HiClawBot/FountLayer"
          rel="noreferrer"
          target="_blank"
        >
          <Code size={18} aria-hidden="true" />
          GitHub
        </a>
      </header>

      <main id="top">
        <section
          className="hero"
          style={{ backgroundImage: `url(${systemMapUrl})` }}
        >
          <div className="hero-overlay" />
          <div className="hero-content">
            <p className="eyebrow">Open-source infrastructure</p>
            <h1>FountLayer</h1>
            <p className="hero-copy">
              The open LLM last-mile distribution layer for apps. Ship AI access
              with attribution, faucet credits, metering, routing, and ledger
              records before you expose a single provider key.
            </p>
            <div className="hero-actions">
              <a className="button primary" href="#loop">
                <Play size={18} aria-hidden="true" />
                Open the loop lab
              </a>
              <a className="button secondary" href="#deploy">
                <BookOpen size={18} aria-hidden="true" />
                Publish on Pages
              </a>
            </div>
            <dl className="hero-metrics">
              <div>
                <dt>Current milestone</dt>
                <dd>v0.5 foundation</dd>
              </div>
              <div>
                <dt>Verified tests</dt>
                <dd>108 passed</dd>
              </div>
              <div>
                <dt>Provider keys</dt>
                <dd>server only</dd>
              </div>
            </dl>
          </div>
        </section>

        <section className="section intro-band" aria-label="Positioning">
          <div className="section-kicker">Why it exists</div>
          <div className="intro-grid">
            <h2>Apps need LLM distribution, not another generic chatbot.</h2>
            <p>
              FountLayer focuses on the operational layer between application UX
              and model providers: who made the request, which channel brought
              it, who funded it, what model route ran, and how the money
              movement reconciles.
            </p>
          </div>
        </section>

        <section className="section loop-section" id="loop">
          <div className="section-header">
            <div>
              <p className="section-kicker">Interactive model</p>
              <h2>Run a last-mile request without touching real keys.</h2>
            </div>
            <p>
              The simulator uses local fixture data to show how a request moves
              from SDK attribution to usage event and ledger entries.
            </p>
          </div>

          <div className="scenario-tabs" role="tablist" aria-label="Scenarios">
            {scenarios.map((item, index) => (
              <button
                aria-selected={index === activeScenario}
                className="scenario-tab"
                key={item.name}
                onClick={() => selectScenario(index)}
                role="tab"
                type="button"
              >
                {item.name}
              </button>
            ))}
          </div>

          <div className="lab-layout" id="scenarios">
            <article className="lab-panel simulator-panel">
              <div className="panel-topline">
                <div>
                  <span className="status-dot" />
                  <span>{scenario.channel}</span>
                </div>
                <span>{scenario.event.mode}</span>
              </div>
              <h3>{scenario.name}</h3>
              <p>{scenario.description}</p>

              <div className="step-stack">
                {visibleSteps.map((item, index) => (
                  <div
                    className={index === activeStep ? "step active" : "step"}
                    key={item.label}
                    style={{ ["--step-index" as string]: index }}
                  >
                    <span className="step-number">{index + 1}</span>
                    <div>
                      <strong>{item.label}</strong>
                      <p>{item.detail}</p>
                    </div>
                    <span className="step-metric">{item.metric}</span>
                  </div>
                ))}
              </div>

              <div className="lab-actions">
                <button
                  className="button primary"
                  disabled={isRunning}
                  onClick={runNextStep}
                  type="button"
                >
                  <ArrowRight size={18} aria-hidden="true" />
                  {isRunning
                    ? "Processing"
                    : isComplete
                      ? "Replay loop"
                      : "Run next step"}
                </button>
                <button
                  className="icon-button"
                  onClick={resetLoop}
                  type="button"
                >
                  <RefreshCcw size={18} aria-hidden="true" />
                  <span>Reset</span>
                </button>
              </div>
            </article>

            <aside className="lab-panel ledger-panel" aria-live="polite">
              <div className="event-card">
                <FileText size={20} aria-hidden="true" />
                <div>
                  <span>usage_event</span>
                  <strong>{scenario.event.appId}</strong>
                  <p>
                    {scenario.event.useCase} · retail {scenario.event.retail}
                  </p>
                </div>
              </div>

              <div
                className="ledger-table"
                role="table"
                aria-label="Ledger rows"
              >
                <div className="ledger-row ledger-head" role="row">
                  <span>Direction</span>
                  <span>Wallet</span>
                  <span>Amount</span>
                </div>
                {scenario.ledger.map((row) => (
                  <div
                    className="ledger-row"
                    key={`${row.wallet}-${row.reason}`}
                  >
                    <span className={`pill ${row.direction}`}>
                      {row.direction}
                    </span>
                    <span>
                      <strong>{row.reason}</strong>
                      <small>{row.wallet}</small>
                    </span>
                    <span>{row.amount}</span>
                  </div>
                ))}
              </div>
              <p className="outcome">{scenario.outcome}</p>
            </aside>
          </div>
        </section>

        <section className="section capability-section">
          <div className="section-header compact">
            <div>
              <p className="section-kicker">What ships first</p>
              <h2>Distribution primitives before chatbot UI.</h2>
            </div>
          </div>
          <div className="capability-grid">
            {capabilities.map((item) => (
              <article className="capability" key={item.label}>
                <item.icon size={22} strokeWidth={1.8} aria-hidden="true" />
                <h3>{item.label}</h3>
                <p>{item.text}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="section security-section" id="security">
          <div>
            <p className="section-kicker">Non-negotiable boundaries</p>
            <h2>Security and accounting are product features.</h2>
          </div>
          <div className="invariant-list">
            {invariants.map((item) => (
              <div className="invariant" key={item}>
                <ShieldCheck size={20} strokeWidth={1.8} aria-hidden="true" />
                <span>{item}</span>
              </div>
            ))}
          </div>
        </section>

        <section className="section deploy-section" id="deploy">
          <div className="deploy-copy">
            <p className="section-kicker">GitHub Pages</p>
            <h2>Static by default, domain-ready when DNS is ready.</h2>
            <p>
              The site can publish from GitHub Actions to the repository Pages
              URL first. When the AiFund DNS record is ready, point a subdomain
              such as <code>fountlayer.aifund.com</code> at GitHub Pages and
              switch the site base path to root.
            </p>
          </div>
          <div className="deploy-steps">
            <div>
              <Database size={20} aria-hidden="true" />
              <span>Build artifact</span>
              <strong>apps/site/dist</strong>
            </div>
            <div>
              <CircuitBoard size={20} aria-hidden="true" />
              <span>Pages workflow</span>
              <strong>GitHub Actions</strong>
            </div>
            <div>
              <KeyRound size={20} aria-hidden="true" />
              <span>Runtime keys</span>
              <strong>none required</strong>
            </div>
          </div>
        </section>
      </main>

      <footer className="footer">
        <div>
          <strong>FountLayer</strong>
          <span>The open LLM last-mile distribution layer for apps.</span>
        </div>
        <a
          href="https://github.com/HiClawBot/FountLayer"
          rel="noreferrer"
          target="_blank"
        >
          View source
        </a>
      </footer>
    </div>
  );
}
