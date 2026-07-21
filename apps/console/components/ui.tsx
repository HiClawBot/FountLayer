import { RefreshCcw, Settings } from "lucide-react";

export function PageHeader({
  title,
  eyebrow,
  source,
}: {
  title: string;
  eyebrow: string;
  source?: "gateway" | "unavailable";
}) {
  return (
    <>
      <header className="page-header">
        <div>
          <h1>{title}</h1>
          <p>{eyebrow}</p>
        </div>
        <div className="toolbar">
          <button className="icon-button" title="Refresh" type="button">
            <RefreshCcw size={17} aria-hidden="true" />
          </button>
          <button className="icon-button" title="Settings" type="button">
            <Settings size={17} aria-hidden="true" />
          </button>
        </div>
      </header>
      {source === "gateway" ? (
        <div className="runtime-source" role="status">
          Source: gateway
        </div>
      ) : source === "unavailable" ? (
        <div className="runtime-alert" role="alert">
          Gateway runtime data is unavailable. No sample records are shown;
          check the Gateway URL, admin token, and dependency health before
          making changes.
        </div>
      ) : null}
    </>
  );
}

export function Metric({
  label,
  value,
  detail,
}: {
  label: string;
  value: string;
  detail: string;
}) {
  return (
    <div className="metric">
      <span>{label}</span>
      <strong>{value}</strong>
      <small>{detail}</small>
    </div>
  );
}

export function Panel({
  title,
  children,
  action,
}: {
  title: string;
  children: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <section className="panel">
      <div className="panel-header">
        <h2>{title}</h2>
        {action}
      </div>
      {children}
    </section>
  );
}

export function Status({
  children,
  tone = "ok",
}: {
  children: React.ReactNode;
  tone?: "ok" | "warn" | "danger";
}) {
  const className = tone === "ok" ? "status" : `status ${tone}`;
  return <span className={className}>{children}</span>;
}
