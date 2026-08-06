import type { Metadata } from "next";
import { Outfit } from "next/font/google";
import "./globals.css";

const outfit = Outfit({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-sans"
});

export const metadata: Metadata = {
  title: "Mana Draw | Marketplace TCG",
  description:
    "Compre singles e produtos selados de Magic, Pokémon e Yu-Gi-Oh!. Condição auditada, Pix e cartão, frete ou retirada."
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
