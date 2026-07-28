import { deriveScryfallBackUrl, isDoubleSidedLayout } from "@/lib/card-images";
import {
  scryfallFinishFromCard,
  scryfallUsdPrice,
  storeFinishFromScryfall,
  usdToCents
} from "@/lib/scryfall-price";
import type { ManaBoxParsedRow } from "@/lib/manabox/parse";
import type { CardCondition, TcgCard } from "@/lib/types";

const SCRYFALL_HEADERS = {
  Accept: "application/json",
  "User-Agent": "ManaDrawTCG/1.0 (ManaBox Bulk Import)",
  "Content-Type": "application/json"
};

export type ScryfallImportCard = {
  id: string;
  name: string;
  set_name?: string;
  set?: string;
  collector_number?: string;
  rarity?: string;
  lang?: string;
  layout?: string;
  finishes?: string[];
  prices?: {
    usd?: string | null;
    usd_foil?: string | null;
    usd_etched?: string | null;
  };
  image_uris?: { normal?: string; large?: string };
  card_faces?: Array<{
    name?: string;
    image_uris?: { normal?: string; large?: string };
  }>;
  type_line?: string;
};

export type ResolvedImportRow = {
  line: number;
  status: "ok" | "error";
  message?: string;
  quantity: number;
  name: string;
  setName: string;
  rarity: string;
  condition: CardCondition;
  language: TcgCard["language"];
  finish: TcgCard["finish"];
  imageUrl: string;
  backImageUrl?: string;
  isDoubleSided: boolean;
  layout?: string;
  tags: string[];
  marketPriceCents: number;
  priceCents: number;
  externalId: string;
  source: "Scryfall";
  purchasePrice?: number | null;
  purchaseCurrency?: string | null;
};

type CollectionResponse = {
  data?: ScryfallImportCard[];
  not_found?: Array<{ id?: string; name?: string; set?: string; collector_number?: string }>;
};

export type BulkPriceMode = "zero" | "purchase_brl" | "fixed";

export type ResolveOptions = {
  defaultCondition: CardCondition;
  defaultLanguage: TcgCard["language"];
  priceMode: BulkPriceMode;
  fixedPriceCents: number;
};

export async function resolveManaBoxRows(
  rows: ManaBoxParsedRow[],
  options: ResolveOptions
): Promise<ResolvedImportRow[]> {
  const cardsByKey = await fetchCardsForRows(rows);

  return rows.map((row) => {
    const card = findCardForRow(row, cardsByKey);
    if (!card) {
      return {
        line: row.line,
        status: "error",
        message: "Não encontrada no Scryfall.",
        quantity: row.quantity,
        name: row.name,
        setName: row.setName || row.setCode || "",
        rarity: row.rarity || "",
        condition: row.condition || options.defaultCondition,
        language: row.language || options.defaultLanguage,
        finish: row.foil || row.etched ? "Foil" : "Normal",
        imageUrl: "",
        isDoubleSided: false,
        tags: [],
        marketPriceCents: 0,
        priceCents: 0,
        externalId: "",
        source: "Scryfall",
        purchasePrice: row.purchasePrice,
        purchaseCurrency: row.purchaseCurrency
      } satisfies ResolvedImportRow;
    }

    const finish: TcgCard["finish"] =
      row.foil || row.etched
        ? "Foil"
        : storeFinishFromScryfall(card.finishes);
    const finishKind =
      row.etched ? "etched" : row.foil ? "foil" : scryfallFinishFromCard(card.finishes);
    const marketUsd = scryfallUsdPrice(card.prices, finishKind);
    const frontImageUrl =
      card.image_uris?.normal ??
      card.image_uris?.large ??
      card.card_faces?.[0]?.image_uris?.normal ??
      card.card_faces?.[0]?.image_uris?.large ??
      "";
    const backImageUrl =
      card.card_faces?.[1]?.image_uris?.normal ??
      card.card_faces?.[1]?.image_uris?.large ??
      deriveScryfallBackUrl(frontImageUrl);
    const layout = card.layout;
    const isDoubleSided = Boolean(backImageUrl) || isDoubleSidedLayout(layout);

    if (!frontImageUrl) {
      return {
        line: row.line,
        status: "error",
        message: "Print sem imagem no Scryfall.",
        quantity: row.quantity,
        name: card.name,
        setName: card.set_name || row.setName || "",
        rarity: titleCase(card.rarity || row.rarity || "Unknown"),
        condition: row.condition || options.defaultCondition,
        language: row.language || mapScryfallLang(card.lang) || options.defaultLanguage,
        finish,
        imageUrl: "",
        isDoubleSided,
        layout,
        tags: [],
        marketPriceCents: usdToCents(marketUsd),
        priceCents: 0,
        externalId: card.id,
        source: "Scryfall",
        purchasePrice: row.purchasePrice,
        purchaseCurrency: row.purchaseCurrency
      } satisfies ResolvedImportRow;
    }

    return {
      line: row.line,
      status: "ok",
      quantity: row.quantity,
      name: card.name,
      setName: card.set_name || row.setName || row.setCode || "Magic",
      rarity: titleCase(card.rarity || row.rarity || "Unknown"),
      condition: row.condition || options.defaultCondition,
      language: row.language || mapScryfallLang(card.lang) || options.defaultLanguage,
      finish,
      imageUrl: frontImageUrl,
      backImageUrl: backImageUrl || undefined,
      isDoubleSided,
      layout,
      tags: compact([
        "Magic",
        card.set,
        card.collector_number,
        card.type_line,
        card.rarity,
        card.layout,
        "manabox-import"
      ]),
      marketPriceCents: usdToCents(marketUsd),
      priceCents: resolveSellPriceCents(row, options),
      externalId: card.id,
      source: "Scryfall",
      purchasePrice: row.purchasePrice,
      purchaseCurrency: row.purchaseCurrency
    } satisfies ResolvedImportRow;
  });
}

function resolveSellPriceCents(row: ManaBoxParsedRow, options: ResolveOptions) {
  if (options.priceMode === "fixed") {
    return Math.max(0, options.fixedPriceCents);
  }
  if (
    options.priceMode === "purchase_brl" &&
    row.purchasePrice != null &&
    (row.purchaseCurrency === "BRL" || !row.purchaseCurrency)
  ) {
    // Só usa preço de compra quando a moeda é BRL (ou ausente e valor parece BRL).
    if (row.purchaseCurrency === "BRL") {
      return Math.round(row.purchasePrice * 100);
    }
  }
  return 0;
}

async function fetchCardsForRows(rows: ManaBoxParsedRow[]) {
  const byId = new Map<string, ScryfallImportCard>();
  const byPrint = new Map<string, ScryfallImportCard>();
  const byNameSet = new Map<string, ScryfallImportCard>();
  const byName = new Map<string, ScryfallImportCard>();

  const identifiers: Array<Record<string, string>> = [];
  const seen = new Set<string>();

  for (const row of rows) {
    if (row.scryfallId) {
      const key = `id:${row.scryfallId}`;
      if (!seen.has(key)) {
        seen.add(key);
        identifiers.push({ id: row.scryfallId });
      }
      continue;
    }
    if (row.setCode && row.collectorNumber) {
      const key = `print:${row.setCode.toLowerCase()}:${row.collectorNumber.toLowerCase()}`;
      if (!seen.has(key)) {
        seen.add(key);
        identifiers.push({
          set: row.setCode.toLowerCase(),
          collector_number: row.collectorNumber
        });
      }
      continue;
    }
    if (row.name && row.setCode) {
      const key = `nameset:${normalizeName(row.name)}:${row.setCode.toLowerCase()}`;
      if (!seen.has(key)) {
        seen.add(key);
        identifiers.push({ name: row.name, set: row.setCode.toLowerCase() });
      }
      continue;
    }
    if (row.name) {
      const key = `name:${normalizeName(row.name)}`;
      if (!seen.has(key)) {
        seen.add(key);
        identifiers.push({ name: row.name });
      }
    }
  }

  for (const chunk of chunkArray(identifiers, 75)) {
    const response = await fetch("https://api.scryfall.com/cards/collection", {
      method: "POST",
      headers: SCRYFALL_HEADERS,
      body: JSON.stringify({ identifiers: chunk }),
      cache: "no-store"
    });

    if (!response.ok) {
      await sleep(120);
      continue;
    }

    const payload = (await response.json()) as CollectionResponse;
    for (const card of payload.data ?? []) {
      indexCard(card, byId, byPrint, byNameSet, byName);
    }
    await sleep(80);
  }

  // Fuzzy fallback for name-only misses (TXT without set).
  const missingNames = [
    ...new Set(
      rows
        .filter((row) => !row.scryfallId && !findCardForRow(row, { byId, byPrint, byNameSet, byName }))
        .map((row) => row.name)
        .filter(Boolean)
    )
  ].slice(0, 40);

  for (const name of missingNames) {
    const card = await fetchNamed(name);
    if (card) indexCard(card, byId, byPrint, byNameSet, byName);
    await sleep(90);
  }

  return { byId, byPrint, byNameSet, byName };
}

function findCardForRow(
  row: ManaBoxParsedRow,
  maps: {
    byId: Map<string, ScryfallImportCard>;
    byPrint: Map<string, ScryfallImportCard>;
    byNameSet: Map<string, ScryfallImportCard>;
    byName: Map<string, ScryfallImportCard>;
  }
) {
  if (row.scryfallId && maps.byId.has(row.scryfallId)) return maps.byId.get(row.scryfallId);
  if (row.setCode && row.collectorNumber) {
    const key = `${row.setCode.toLowerCase()}::${row.collectorNumber.toLowerCase()}`;
    if (maps.byPrint.has(key)) return maps.byPrint.get(key);
  }
  if (row.name && row.setCode) {
    const key = `${normalizeName(row.name)}::${row.setCode.toLowerCase()}`;
    if (maps.byNameSet.has(key)) return maps.byNameSet.get(key);
  }
  if (row.name) return maps.byName.get(normalizeName(row.name));
  return undefined;
}

function indexCard(
  card: ScryfallImportCard,
  byId: Map<string, ScryfallImportCard>,
  byPrint: Map<string, ScryfallImportCard>,
  byNameSet: Map<string, ScryfallImportCard>,
  byName: Map<string, ScryfallImportCard>
) {
  byId.set(card.id, card);
  if (card.set && card.collector_number) {
    byPrint.set(`${card.set.toLowerCase()}::${card.collector_number.toLowerCase()}`, card);
  }
  if (card.set) {
    byNameSet.set(`${normalizeName(card.name)}::${card.set.toLowerCase()}`, card);
    const front = card.name.split(" // ")[0]?.trim();
    if (front) byNameSet.set(`${normalizeName(front)}::${card.set.toLowerCase()}`, card);
  }
  byName.set(normalizeName(card.name), card);
  const front = card.name.split(" // ")[0]?.trim();
  if (front) byName.set(normalizeName(front), card);
}

async function fetchNamed(name: string) {
  const params = new URLSearchParams({ fuzzy: name });
  const response = await fetch(`https://api.scryfall.com/cards/named?${params}`, {
    headers: SCRYFALL_HEADERS,
    cache: "no-store"
  });
  if (!response.ok) return null;
  return (await response.json()) as ScryfallImportCard;
}

function mapScryfallLang(lang?: string): TcgCard["language"] | undefined {
  if (!lang) return undefined;
  const value = lang.toLowerCase();
  if (value === "en") return "EN";
  if (value === "pt") return "PT";
  if (value === "ja" || value === "jp") return "JP";
  return undefined;
}

function titleCase(value: string) {
  return value
    .split(/[\s_]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(" ");
}

function compact(values: Array<string | undefined | null>) {
  return [...new Set(values.map((value) => value?.trim()).filter(Boolean) as string[])];
}

function normalizeName(name: string) {
  return name
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ");
}

function chunkArray<T>(items: T[], size: number) {
  const out: T[][] = [];
  for (let index = 0; index < items.length; index += size) {
    out.push(items.slice(index, index + size));
  }
  return out;
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
