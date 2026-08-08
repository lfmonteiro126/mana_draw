import { isDoubleSidedLayout } from "@/lib/card-images";
import { scryfallUsdPrice, usdToCents } from "@/lib/scryfall-price";
import type { CardCondition, TcgCard } from "@/lib/types";

export type ScannedCardResult = {
  id: string;
  name: string;
  setName: string;
  setCode: string;
  collectorNumber: string;
  rarity: string;
  imageUrl: string;
  backImageUrl?: string;
  isDoubleSided: boolean;
  layout?: string;
  manaCost?: string;
  typeLine?: string;
  oracleText?: string;
  usdPrice: number;
  marketPriceCents: number;
  scryfallUri?: string;
  finishes: string[];
  game: "Magic";
  condition: CardCondition;
  language: TcgCard["language"];
  finish: TcgCard["finish"];
  printsCount?: number;
};

const SCRYFALL_HEADERS = {
  Accept: "application/json",
  "User-Agent": "ManaDrawScanner/1.0"
};

/**
 * Remove ruídos comuns gerados por OCR de câmera em cartas de Magic.
 * Ex.: símbolos de mana ({W}, {2}), quebras de linha estranhas, números de edição no topo, etc.
 */
export function cleanOcrText(raw: string): string {
  if (!raw) return "";

  let cleaned = raw
    // Normaliza quebras de linha e tabs
    .replace(/[\r\n\t]+/g, " ")
    // Remove caracteres não-alfanuméricos no início/fim de linha
    .replace(/^[^a-zA-Z0-9]+|[^a-zA-Z0-9]+$/g, "")
    // Remove símbolos de mana e parênteses OCR (ex: {1}{U}, (2), [B])
    .replace(/[\{\[\(][0-9WUBRGXwubrgx\/]+[\}\]\)]/g, "")
    // Remove números soltos que sejam de custo de mana no final
    .replace(/\s+[0-9]{1,2}$/, "")
    // Substitui múltiplos espaços
    .replace(/\s{2,}/g, " ")
    .trim();

  // Se o OCR capturou duas linhas (ex: "Delver of Secrets // Insectile Aberration"), mantemos a primeira face
  if (cleaned.includes("//")) {
    cleaned = cleaned.split("//")[0].trim();
  }

  return cleaned;
}

/**
 * Converte o payload retornado da API do Scryfall para a estrutura ScannedCardResult
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function parseScryfallCardToResult(card: any): ScannedCardResult {
  const isDouble = isDoubleSidedLayout(card.layout) || Boolean(card.card_faces && card.card_faces.length > 1);

  const frontFace = isDouble && card.card_faces?.[0] ? card.card_faces[0] : null;
  const backFace = isDouble && card.card_faces?.[1] ? card.card_faces[1] : null;

  const imageUrl =
    frontFace?.image_uris?.normal ||
    frontFace?.image_uris?.large ||
    card.image_uris?.normal ||
    card.image_uris?.large ||
    "";

  const backImageUrl =
    backFace?.image_uris?.normal ||
    backFace?.image_uris?.large ||
    undefined;

  const usd = scryfallUsdPrice(card.prices, "auto");
  const finishes = card.finishes || ["nonfoil"];
  const isFoilOnly = finishes.includes("foil") && !finishes.includes("nonfoil");

  return {
    id: card.id,
    name: card.name,
    setName: card.set_name || card.set?.toUpperCase() || "Magic",
    setCode: (card.set || "").toUpperCase(),
    collectorNumber: card.collector_number || "",
    rarity: capitalizeFirst(card.rarity || "Common"),
    imageUrl,
    backImageUrl,
    isDoubleSided: isDouble,
    layout: card.layout || (isDouble ? "transform" : "normal"),
    manaCost: frontFace?.mana_cost || card.mana_cost || "",
    typeLine: frontFace?.type_line || card.type_line || "",
    oracleText: frontFace?.oracle_text || card.oracle_text || "",
    usdPrice: usd,
    marketPriceCents: usdToCents(usd),
    scryfallUri: card.scryfall_uri,
    finishes,
    game: "Magic",
    condition: "NM",
    language: "EN",
    finish: isFoilOnly ? "Foil" : "Normal"
  };
}

function capitalizeFirst(val: string): string {
  if (!val) return "";
  return val.charAt(0).toUpperCase() + val.slice(1);
}

/**
 * Busca por correspondência aproximada (fuzzy) no Scryfall.
 * Tolera erros de digitação e pequenos desvios do OCR.
 */
export async function searchScryfallByFuzzy(query: string): Promise<ScannedCardResult | null> {
  const cleaned = cleanOcrText(query);
  if (cleaned.length < 2) return null;

  const params = new URLSearchParams({
    fuzzy: cleaned
  });

  try {
    const res = await fetch(`https://api.scryfall.com/cards/named?${params.toString()}`, {
      headers: SCRYFALL_HEADERS,
      next: { revalidate: 60 * 60 * 24 } // Cache de 24h
    });

    if (!res.ok) {
      // Se fuzzy falhou, tenta busca com wildcard
      return searchScryfallByWildcard(cleaned);
    }

    const data = await res.json();
    return parseScryfallCardToResult(data);
  } catch (err) {
    console.error("searchScryfallByFuzzy error:", err);
    return null;
  }
}

/**
 * Busca alternativa caso a busca fuzzy falhe (usa /cards/search?q=...)
 */
export async function searchScryfallByWildcard(cleaned: string): Promise<ScannedCardResult | null> {
  try {
    const params = new URLSearchParams({
      q: `!"${cleaned}" or ${cleaned}`,
      order: "released",
      dir: "desc"
    });

    const res = await fetch(`https://api.scryfall.com/cards/search?${params.toString()}`, {
      headers: SCRYFALL_HEADERS,
      next: { revalidate: 60 * 60 * 24 }
    });

    if (!res.ok) return null;

    const payload = await res.json();
    if (payload.data && payload.data.length > 0) {
      return parseScryfallCardToResult(payload.data[0]);
    }
    return null;
  } catch (err) {
    console.error("searchScryfallByWildcard error:", err);
    return null;
  }
}
