import type { Game } from "@/lib/types";

export type CardLegality = {
  format: string;
  status: "legal" | "not_legal" | "banned" | "restricted" | "other";
};

export type CardPrintRow = {
  id: string;
  setName: string;
  setCode: string;
  collectorNumber: string;
  rarity: string;
  usd: string | null;
  eur: string | null;
  tix: string | null;
  imageUrl: string;
  selected: boolean;
};

export type CardDetailsPayload = {
  game: Game;
  name: string;
  manaCost: string;
  typeLine: string;
  oracleText: string;
  flavorText: string;
  artist: string;
  imageUrl: string;
  backImageUrl?: string;
  setName: string;
  setCode: string;
  collectorNumber: string;
  rarity: string;
  language: string;
  finishes: string[];
  legalities: CardLegality[];
  prints: CardPrintRow[];
  languages: string[];
  /** Preço Scryfall do print atual em centavos de USD. */
  marketUsdCents?: number;
  store?: {
    priceCents: number;
    marketPriceCents: number;
    stock: number;
    condition: string;
  };
};
