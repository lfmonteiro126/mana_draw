import type { TcgCard } from "@/lib/types";

type ScryfallPrices = {
  usd?: string | null;
  usd_foil?: string | null;
  usd_etched?: string | null;
  eur?: string | null;
  eur_foil?: string | null;
};

export type ScryfallPriceFinish = "nonfoil" | "foil" | "etched" | "auto";

function positive(value?: string | null) {
  const price = Number(value);
  return Number.isFinite(price) && price > 0 ? price : 0;
}

/** Preço USD do print Scryfall, alinhado ao finish — sem misturar EUR. */
export function scryfallUsdPrice(
  prices: ScryfallPrices | null | undefined,
  finish: ScryfallPriceFinish = "auto"
) {
  const p = prices ?? {};

  if (finish === "foil") {
    return positive(p.usd_foil) || positive(p.usd_etched);
  }
  if (finish === "etched") {
    return positive(p.usd_etched) || positive(p.usd_foil);
  }
  if (finish === "nonfoil") {
    return positive(p.usd);
  }

  // auto: nonfoil primeiro; só usa foil se não houver nonfoil
  return positive(p.usd) || positive(p.usd_foil) || positive(p.usd_etched);
}

export function scryfallFinishFromCard(finishes?: string[] | null): ScryfallPriceFinish {
  const list = finishes ?? [];
  const hasNonfoil = list.includes("nonfoil");
  const hasFoil = list.includes("foil");
  const hasEtched = list.includes("etched");

  if (hasNonfoil) return "nonfoil";
  if (hasFoil) return "foil";
  if (hasEtched) return "etched";
  return "auto";
}

export function storeFinishFromScryfall(finishes?: string[] | null): TcgCard["finish"] {
  const finish = scryfallFinishFromCard(finishes);
  if (finish === "foil" || finish === "etched") return "Foil";
  return "Normal";
}

export function scryfallFinishFromStoreFinish(finish: TcgCard["finish"]): ScryfallPriceFinish {
  if (finish === "Foil" || finish === "Holo" || finish === "Secret") return "foil";
  return "nonfoil";
}

export function usdToCents(usd: number) {
  return Number.isFinite(usd) && usd > 0 ? Math.round(usd * 100) : 0;
}
