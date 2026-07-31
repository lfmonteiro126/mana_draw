import {
  inferSealedType,
  tcgplayerImageUrl,
  tcgplayerProductLine,
  type SealedType
} from "@/lib/sealed";
import type { Game } from "@/lib/types";

export type SealedSuggestion = {
  externalId: string;
  name: string;
  game: Game;
  setName: string;
  sealedType: SealedType;
  language: "PT" | "EN" | "JP";
  marketPriceCents: number;
  marketCurrency: "USD";
  imageUrl: string;
  source: "TCGPlayer";
  tags: string[];
};

type TcgSearchProduct = {
  productId?: number;
  productName?: string;
  setName?: string;
  productLineName?: string;
  marketPrice?: number | null;
  medianPrice?: number | null;
  lowestPrice?: number | null;
  sealed?: boolean;
};

const USER_AGENT = "ManaDrawTCG/1.0 (Sealed Catalog Lookup)";

export async function searchSealedProducts(
  game: Game,
  query: string
): Promise<SealedSuggestion[]> {
  const trimmed = query.trim();
  if (trimmed.length < 2) return [];

  const line = tcgplayerProductLine(game);
  const url =
    `https://mp-search-api.tcgplayer.com/v1/search/request?q=${encodeURIComponent(trimmed)}&isList=false`;

  const body = {
    algorithm: "sales_exp_fields_experiment",
    from: 0,
    size: 12,
    filters: {
      term: {
        productLineName: [line],
        productTypeName: ["Sealed Products"]
      },
      range: {},
      match: {}
    }
  };

  const response = await fetch(url, {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      "User-Agent": USER_AGENT
    },
    body: JSON.stringify(body),
    next: { revalidate: 0 }
  });

  if (!response.ok) return [];

  const payload = (await response.json()) as {
    results?: Array<{ results?: TcgSearchProduct[] }>;
  };
  const rows = payload.results?.[0]?.results ?? [];

  const suggestions: SealedSuggestion[] = [];
  const seen = new Set<string>();

  for (const row of rows) {
    const productId = Number(row.productId);
    if (!Number.isFinite(productId) || productId <= 0) continue;

    const name = String(row.productName ?? "").trim();
    if (!name) continue;

    const key = String(productId);
    if (seen.has(key)) continue;
    seen.add(key);

    const marketUsd = pickUsd(row.marketPrice, row.medianPrice, row.lowestPrice);
    const sealedType = inferSealedType(game, name);
    const setName = String(row.setName ?? "").trim() || extractSetFromName(name);

    suggestions.push({
      externalId: `tcgplayer:${productId}`,
      name,
      game,
      setName,
      sealedType,
      language: "EN",
      marketPriceCents: Math.round(marketUsd * 100),
      marketCurrency: "USD",
      imageUrl: tcgplayerImageUrl(productId),
      source: "TCGPlayer",
      tags: ["Selado", sealedTypeLabelTag(sealedType), game]
    });
  }

  return suggestions;
}

function pickUsd(...values: Array<number | null | undefined>) {
  for (const value of values) {
    if (typeof value === "number" && Number.isFinite(value) && value > 0) {
      return value;
    }
  }
  return 0;
}

function extractSetFromName(name: string) {
  const cleaned = name
    .replace(/\s*[-–—]\s*.*$/, "")
    .replace(
      /\b(booster|collector|elite|trainer|structure|deck|box|display|bundle|tin|pack|case|collection|ultra|premium)\b.*/i,
      ""
    )
    .trim();
  return cleaned || name;
}

function sealedTypeLabelTag(type: SealedType) {
  return type
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}
