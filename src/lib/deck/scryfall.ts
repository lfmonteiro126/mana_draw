import type { ScryfallCardData } from "./types";

const SCRYFALL_HEADERS = {
  Accept: "application/json",
  "User-Agent": "ManaDrawTCG/1.0 (Commander Deck Analyzer)",
  "Content-Type": "application/json"
};

type CollectionNotFound = { name?: string; set?: string };

type CollectionResponse = {
  data?: ScryfallCardData[];
  not_found?: CollectionNotFound[];
};

export type ScryfallLookup = {
  name: string;
  setCode?: string;
  collectorNumber?: string;
};

export async function fetchScryfallCollection(lookups: Array<string | ScryfallLookup>) {
  const normalizedLookups = lookups
    .map((entry) => (typeof entry === "string" ? { name: entry } : entry))
    .map((entry) => ({
      name: entry.name.trim(),
      setCode: entry.setCode?.trim().toLowerCase() || undefined,
      collectorNumber: entry.collectorNumber?.trim() || undefined
    }))
    .filter((entry) => entry.name);

  const uniqueKeys = new Map<string, ScryfallLookup>();
  for (const entry of normalizedLookups) {
    const key = lookupKey(entry);
    if (!uniqueKeys.has(key)) uniqueKeys.set(key, entry);
  }
  const unique = [...uniqueKeys.values()];

  const found = new Map<string, ScryfallCardData>();
  const unresolved: string[] = [];

  for (const chunk of chunkArray(unique, 75)) {
    const response = await fetch("https://api.scryfall.com/cards/collection", {
      method: "POST",
      headers: SCRYFALL_HEADERS,
      body: JSON.stringify({
        identifiers: chunk.map((entry) => {
          if (entry.setCode && entry.collectorNumber) {
            return { set: entry.setCode, collector_number: entry.collectorNumber };
          }
          if (entry.setCode) {
            return { name: entry.name, set: entry.setCode };
          }
          return { name: entry.name };
        })
      }),
      cache: "no-store"
    });

    if (!response.ok) {
      unresolved.push(...chunk.map((entry) => entry.name));
      await sleep(120);
      continue;
    }

    const payload = (await response.json()) as CollectionResponse;
    for (const card of payload.data ?? []) {
      rememberCard(found, card);
    }
    for (const missing of payload.not_found ?? []) {
      if (missing.name) unresolved.push(missing.name);
    }

    await sleep(80);
  }

  const stillMissing = [
    ...new Set(
      unique
        .map((entry) => entry.name)
        .filter((name) => !found.has(normalizeName(name)))
        .concat(unresolved.filter((name) => !found.has(normalizeName(name))))
    )
  ];

  // Fuzzy / PT: sobe o teto para decks ~100 cartas com vários misses.
  for (const name of stillMissing.slice(0, 40)) {
    const card = await fetchScryfallNamed(name);
    if (card) {
      found.set(normalizeName(name), card);
      rememberCard(found, card);
    }
    await sleep(90);
  }

  const finalUnresolved = [...new Set(normalizedLookups.map((entry) => entry.name))].filter(
    (name) => !found.has(normalizeName(name))
  );
  return { found, unresolved: finalUnresolved };
}

function rememberCard(found: Map<string, ScryfallCardData>, card: ScryfallCardData) {
  found.set(normalizeName(card.name), card);
  const front = card.name.split(" // ")[0]?.trim();
  if (front) found.set(normalizeName(front), card);
  const printed = (card as ScryfallCardData & { printed_name?: string }).printed_name;
  if (printed) found.set(normalizeName(printed), card);
}

async function fetchScryfallNamed(name: string) {
  const params = new URLSearchParams({ fuzzy: name });
  const response = await fetch(`https://api.scryfall.com/cards/named?${params}`, {
    headers: SCRYFALL_HEADERS,
    cache: "no-store"
  });
  if (response.ok) {
    return (await response.json()) as ScryfallCardData;
  }

  // Fallback PT: printed_name exato
  const search = new URLSearchParams({
    q: `printed_name:"${name.replace(/"/g, "")}"`,
    unique: "cards"
  });
  const printed = await fetch(`https://api.scryfall.com/cards/search?${search}`, {
    headers: SCRYFALL_HEADERS,
    cache: "no-store"
  });
  if (!printed.ok) return null;
  const payload = (await printed.json()) as { data?: ScryfallCardData[] };
  return payload.data?.[0] ?? null;
}

export async function fetchScryfallCardByName(name: string) {
  return fetchScryfallNamed(name.trim());
}

export function normalizeName(name: string) {
  return name
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ");
}

function lookupKey(entry: ScryfallLookup) {
  return `${normalizeName(entry.name)}::${entry.setCode ?? ""}::${entry.collectorNumber ?? ""}`;
}

export function cardOracleText(card: ScryfallCardData) {
  if (card.oracle_text) return card.oracle_text;
  return (card.card_faces ?? [])
    .map((face) => face.oracle_text ?? "")
    .filter(Boolean)
    .join("\n");
}

export function cardImageUrl(card: ScryfallCardData) {
  return (
    card.image_uris?.normal ??
    card.image_uris?.small ??
    card.card_faces?.[0]?.image_uris?.normal ??
    card.card_faces?.[0]?.image_uris?.small ??
    ""
  );
}

export function cardArtCropUrl(card: ScryfallCardData) {
  const direct =
    card.image_uris?.art_crop ??
    card.card_faces?.[0]?.image_uris?.art_crop ??
    "";
  if (direct) return direct;

  const fallback = cardImageUrl(card);
  if (!fallback) return "";
  return fallback
    .replace("/normal/", "/art_crop/")
    .replace("/large/", "/art_crop/")
    .replace("/small/", "/art_crop/");
}

export function cardTypeLine(card: ScryfallCardData) {
  if (card.type_line) return card.type_line;
  return (card.card_faces ?? []).map((face) => face.type_line ?? "").filter(Boolean).join(" // ");
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
