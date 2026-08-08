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
  // Scryfall asks for an identifying UA; keep contact-friendly for rate-limit goodwill.
  "User-Agent": "ManaDrawScanner/1.0 (https://github.com/lfmonteiro126/mana_draw)"
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
    // Remove símbolos de mana e parênteses OCR (ex: {1}{U}, (2), [B])
    .replace(/[\{\[\(][0-9WUBRGXwubrgx\/]+[\}\]\)]/g, "")
    // Remove ruído comum de moldura/set symbol lido como lixo
    .replace(/[|\\<>~`^_]+/g, " ")
    // Remove caracteres não-alfanuméricos no início/fim
    .replace(/^[^a-zA-Z0-9]+|[^a-zA-Z0-9]+$/g, "")
    // Remove números soltos que sejam de custo de mana no final
    .replace(/\s+[0-9]{1,2}$/, "")
    // Substitui múltiplos espaços
    .replace(/\s{2,}/g, " ")
    .trim();

  // Se o OCR capturou duas faces (ex: "Delver of Secrets // Insectile Aberration"), mantém a frente
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

  // Reject obvious OCR garbage before hitting Scryfall (avoids random fuzzy hits).
  if (cleaned.length < 3) return null;

  try {
    const params = new URLSearchParams({ fuzzy: cleaned });
    const res = await fetch(`https://api.scryfall.com/cards/named?${params.toString()}`, {
      headers: SCRYFALL_HEADERS,
      next: { revalidate: 60 * 60 * 24 }
    });

    if (res.ok) {
      const data = await res.json();
      const parsed = parseScryfallCardToResult(data);
      // Guard against fuzzy matching totally unrelated short junk.
      if (isReasonableNameMatch(cleaned, parsed.name)) {
        return parsed;
      }
    }

    const fromAutocomplete = await searchScryfallByAutocomplete(cleaned);
    if (fromAutocomplete) return fromAutocomplete;

    return searchScryfallByWildcard(cleaned);
  } catch (err) {
    console.error("searchScryfallByFuzzy error:", err);
    return null;
  }
}

function isReasonableNameMatch(query: string, cardName: string): boolean {
  const q = query.toLowerCase();
  const n = cardName.toLowerCase().split(" // ")[0];
  if (n.includes(q) || q.includes(n)) return true;

  // Token overlap: at least one meaningful shared token (len >= 3).
  const qTokens = q.split(/\s+/).filter((t) => t.length >= 3);
  const nTokens = new Set(n.split(/\s+/).filter((t) => t.length >= 3));
  if (qTokens.some((t) => nTokens.has(t))) return true;

  // Soft Levenshtein-ish for short single-token names.
  if (qTokens.length === 1 && nTokens.size === 1) {
    const only = [...nTokens][0];
    if (Math.abs(only.length - q.length) <= 2) return true;
  }

  // Fuzzy API already matched — accept when query is reasonably long.
  return q.length >= 8;
}

async function searchScryfallByAutocomplete(cleaned: string): Promise<ScannedCardResult | null> {
  try {
    const params = new URLSearchParams({ q: cleaned });
    const res = await fetch(`https://api.scryfall.com/cards/autocomplete?${params.toString()}`, {
      headers: SCRYFALL_HEADERS,
      next: { revalidate: 60 * 60 }
    });
    if (!res.ok) return null;
    const payload = (await res.json()) as { data?: string[] };
    const suggestion = payload.data?.[0];
    if (!suggestion) return null;

    const named = await fetch(
      `https://api.scryfall.com/cards/named?${new URLSearchParams({ exact: suggestion }).toString()}`,
      {
        headers: SCRYFALL_HEADERS,
        next: { revalidate: 60 * 60 * 24 }
      }
    );
    if (!named.ok) return null;
    return parseScryfallCardToResult(await named.json());
  } catch (err) {
    console.error("searchScryfallByAutocomplete error:", err);
    return null;
  }
}

/**
 * Busca alternativa caso a busca fuzzy falhe (usa /cards/search?q=...)
 */
export async function searchScryfallByWildcard(cleaned: string): Promise<ScannedCardResult | null> {
  try {
    const escaped = cleaned.replace(/"/g, "");
    const params = new URLSearchParams({
      q: `name:/^${escapeRegex(escaped)}/ or name:${escaped}*`,
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
      const parsed = parseScryfallCardToResult(payload.data[0]);
      if (isReasonableNameMatch(cleaned, parsed.name)) return parsed;
    }
    return null;
  } catch (err) {
    console.error("searchScryfallByWildcard error:", err);
    return null;
  }
}

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
