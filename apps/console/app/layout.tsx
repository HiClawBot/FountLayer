import type { Metadata } from "next";

import { ConsoleShell } from "../components/console-shell";
import "./globals.css";

export const metadata: Metadata = {
  title: "FountLayer Console",
  description:
    "Operational console for FountLayer distribution, metering, and ledger data.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>
        <ConsoleShell>{children}</ConsoleShell>
      </body>
    </html>
  );
}
