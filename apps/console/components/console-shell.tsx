import {
  BadgeDollarSign,
  Boxes,
  CircuitBoard,
  KeyRound,
  Landmark,
  LayoutDashboard,
  RadioTower,
  Route,
  SlidersHorizontal,
  WalletCards,
} from "lucide-react";
import Link from "next/link";

import { logoutConsoleOperator } from "../app/login/actions";

const navItems = [
  { href: "/overview", label: "Overview", icon: LayoutDashboard },
  { href: "/setup", label: "Setup", icon: SlidersHorizontal },
  { href: "/apps", label: "Apps", icon: Boxes },
  { href: "/channels", label: "Channels", icon: RadioTower },
  { href: "/routes", label: "Routes", icon: Route },
  { href: "/credentials", label: "Credentials", icon: KeyRound },
  { href: "/faucet", label: "Faucet", icon: WalletCards },
  { href: "/pricing", label: "Pricing", icon: BadgeDollarSign },
  { href: "/usage-ledger", label: "Usage & Ledger", icon: Landmark },
];

export function ConsoleShell({ children }: { children: React.ReactNode }) {
  const gatewayBaseUrl =
    process.env.CONSOLE_GATEWAY_BASE_URL ??
    process.env.GATEWAY_BASE_URL ??
    "http://localhost:3300";

  return (
    <div className="shell">
      <aside className="sidebar">
        <div className="brand">
          <strong>FountLayer</strong>
          <span>Distribution Console</span>
        </div>
        <nav className="nav" aria-label="Console sections">
          {navItems.map((item) => {
            const Icon = item.icon;
            return (
              <Link href={item.href} key={item.href}>
                <Icon size={18} aria-hidden="true" />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>
        <div className="brand">
          <CircuitBoard size={20} aria-hidden="true" />
          <span>Gateway {gatewayBaseUrl}</span>
        </div>
        <form action={logoutConsoleOperator}>
          <button className="logout-button" type="submit">
            Sign out
          </button>
        </form>
      </aside>
      <main className="main">{children}</main>
    </div>
  );
}
