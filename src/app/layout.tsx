import type { Metadata } from "next";
import { Outfit } from "next/font/google";
import "./globals.css";

const outfit = Outfit({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-sans"
});

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
    <html lang="pt-BR" className={outfit.variable}>
      <body className={outfit.className}>{children}</body>
    </html>
  );
}
