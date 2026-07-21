import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Mana Draw | TCG Store",
  description: "Marketplace minimalista para cartas Magic, Yu-Gi-Oh! e Pokemon."
};

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  );
}
