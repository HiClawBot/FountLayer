import type { Metadata } from "next";

import "./globals.css";

export const metadata: Metadata = {
  title: "FountLayer Document Reader Demo",
  description:
    "Managed-mode document reader demo for the FountLayer beta loop.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
